import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../src/lib/migrations';
import { claimAutomation,settleAutomation } from '../src/lib/automation';
import { requestResponse,decideResponse } from '../src/lib/response';
import { runLocal } from '../src/lib/automation-provider';
import type { SqlClient } from '../src/lib/sql-client';
import type { QueryResultRow } from 'pg';
import type { Role } from '../src/lib/rbac';
test('response permissions, independent review, atomic receipts, duplicate prevention and rollback',async()=>{
 const db=new PGlite();
 const migrationClient:SqlClient={async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(values===undefined){await db.exec(sql);return {rows:[] as Row[]};}return db.query<Row>(sql,values);}};
 try{
  await applyMigrations(migrationClient);await applyMigrations(migrationClient);
  const identities=[];
  for(const role of ['VIEWER','ANALYST','ADMIN'] as Role[]){
   const {rows:[user]}=await db.query<{id:string}>("INSERT INTO users(email,name,password_hash,role) VALUES ($1,'Test','unused',$2) RETURNING id",[`${role.toLowerCase()}@test.invalid`,role]);identities.push({id:user.id,role});
  }
  const [viewer,analyst,admin]=identities;
  const {rows:[incident]}=await db.query<{id:string}>("INSERT INTO alerts(title,rule_id,severity,evidence) VALUES ('Test','test','HIGH',$1) RETURNING id",[JSON.stringify({actor:'day5-demo'})]);
  const requestInput={incidentId:incident.id,reason:'Eight failures justify investigating this actor.'};
  await assert.rejects(requestResponse(db,viewer,requestInput),/Only Analysts/);
  // Fresh database role wins over a spoofed or stale application role.
  await assert.rejects(requestResponse(db,{...viewer,role:'ADMIN'},requestInput),/Only Analysts/);
  const id=await requestResponse(db,analyst,requestInput);
  await assert.rejects(requestResponse(db,analyst,requestInput),/already awaiting/);
  const decision={requestId:id,decision:'APPROVE',note:'Evidence reviewed; run the simulated containment.'};
  await assert.rejects(decideResponse(db,analyst,decision),/Only Admins/);
  await assert.rejects(decideResponse(db,viewer,decision),/Only Admins/);
  await db.query("UPDATE alerts SET evidence=$1 WHERE id=$2",[JSON.stringify({actor:'changed-after-request'}),incident.id]);
  await decideResponse(db,admin,decision);
  assert.equal((await db.query<{status:string}>('SELECT status FROM response_requests WHERE id=$1',[id])).rows[0].status,'APPROVED');
  await assert.rejects(requestResponse(db,analyst,requestInput),/already awaiting/);
  const job=await claimAutomation(db);assert.ok(job);
  await settleAutomation(db,job,{result:{jobId:job.id,incidentId:incident.id,kind:'CONTAIN_SIMULATED',engine:'WINDMILL',realWorldChanges:false,responseId:id,actor:'day5-demo',action:'CONTAIN_ACTOR',mode:'SIMULATION',message:'Simulated containment only.'}});
  const {rows:[completed]}=await db.query<{status:string;result:{actor:string;realWorldChanges:boolean}}>('SELECT status,result FROM response_requests WHERE id=$1',[id]);
  assert.equal(completed.status,'SUCCEEDED');assert.equal(completed.result.actor,'day5-demo');assert.equal(completed.result.realWorldChanges,false);
  assert.equal((await db.query<{status:string}>('SELECT status FROM alerts WHERE id=$1',[incident.id])).rows[0].status,'OPEN');
  await assert.rejects(decideResponse(db,admin,decision),/already been decided/);
  assert.equal((await db.query("SELECT * FROM audit_logs WHERE action='response.simulated'")).rows.length,1);
  const selfId=await requestResponse(db,admin,requestInput);
  await assert.rejects(decideResponse(db,admin,{...decision,requestId:selfId}),/different Admin/);
  await db.query("UPDATE users SET role='ADMIN' WHERE id=$1",[analyst.id]);
  await decideResponse(db,analyst,{...decision,requestId:selfId,decision:'REJECT'});
  assert.equal((await db.query<{status:string}>('SELECT status FROM response_requests WHERE id=$1',[selfId])).rows[0].status,'REJECTED');
  const pendingId=await requestResponse(db,analyst,requestInput);
  await db.query("UPDATE alerts SET status='RESOLVED' WHERE id=$1",[incident.id]);
  await assert.rejects(decideResponse(db,admin,{...decision,requestId:pendingId}),/resolved/);
  await assert.rejects(requestResponse(db,analyst,requestInput),/Reopen/);
  await decideResponse(db,admin,{...decision,requestId:pendingId,decision:'REJECT'});
  await db.query("UPDATE alerts SET status='OPEN',evidence='{}' WHERE id=$1",[incident.id]);
  await assert.rejects(requestResponse(db,analyst,requestInput),/no valid actor/);
  await db.query('UPDATE alerts SET evidence=$1 WHERE id=$2',[JSON.stringify({actor:'day5-demo'}),incident.id]);
  const failing:SqlClient={async query(sql,values){if(sql.includes('INSERT INTO audit_logs'))throw new Error('Injected audit failure');return db.query(sql,values);}};
  const count=(await db.query('SELECT * FROM response_requests')).rows.length;
  await assert.rejects(requestResponse(failing,analyst,requestInput),/Injected audit failure/);
  assert.equal((await db.query('SELECT * FROM response_requests')).rows.length,count);
  const retryId=await requestResponse(db,analyst,requestInput);
  await assert.rejects(decideResponse(failing,admin,{...decision,requestId:retryId}),/Injected audit failure/);
  const {rows:[rolledBack]}=await db.query<{status:string;decided_by:string|null;result:unknown}>('SELECT status,decided_by,result FROM response_requests WHERE id=$1',[retryId]);
  assert.equal(rolledBack.status,'PENDING');assert.equal(rolledBack.decided_by,null);assert.equal(rolledBack.result,null);
  await db.query('UPDATE users SET disabled=true WHERE id=$1',[admin.id]);
  await assert.rejects(decideResponse(db,admin,{...decision,requestId:retryId}),/unavailable/);
  await assert.rejects(requestResponse(db,analyst,{...requestInput,reason:'short'}));
 }finally{await db.close();}
});
test('local provider executes containment only for queued independent Admin approval and settles atomically',async()=>{
 const db=new PGlite();
 const client:SqlClient={async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(values===undefined){await db.exec(sql);return {rows:[] as Row[]};}return db.query<Row>(sql,values);}};
 try{
  await applyMigrations(client);
  const ids=[];for(const role of ['ANALYST','ADMIN'] as Role[]){const {rows:[u]}=await db.query<{id:string}>("INSERT INTO users(email,name,password_hash,role) VALUES ($1,'Test','unused',$2) RETURNING id",[`${role.toLowerCase()}@local.test`,role]);ids.push({id:u.id,role});}
  const {rows:[incident]}=await db.query<{id:string}>("INSERT INTO alerts(title,rule_id,severity,evidence) VALUES ('Local','test','HIGH',$1) RETURNING id",[JSON.stringify({actor:'local-target'})]);
  const requestId=await requestResponse(db,ids[0],{incidentId:incident.id,reason:'Review this actor and contain only in simulation.'});
  const unapproved={id:(await import('node:crypto')).randomUUID(),incident_id:incident.id,response_id:requestId,kind:'CONTAIN_SIMULATED',status:'RUNNING',payload:{actor:'local-target',approved:true,requestedBy:ids[0].id,approvedBy:ids[1].id},result:null,attempts:1,lease_token:null,error_code:null,created_at:new Date(),finished_at:null} as const;
  await assert.rejects(runLocal(unapproved,db),/APPROVAL_INVALID/);
  await decideResponse(db,ids[1],{requestId,decision:'APPROVE',note:'Approve this simulated action independently.'});
  const job=await claimAutomation(db);assert.ok(job);const result=await runLocal(job,db);
  assert.equal(result.engine,'LOCAL');assert.equal(result.realWorldChanges,false);
  await settleAutomation(db,job,{result},'local');
  const {rows:[receipt]}=await db.query<{status:string;result:{engine:string;realWorldChanges:boolean}}>('SELECT status,result FROM response_requests WHERE id=$1',[requestId]);
  assert.equal(receipt.status,'SUCCEEDED');assert.equal(receipt.result.engine,'LOCAL');assert.equal(receipt.result.realWorldChanges,false);
  assert.equal((await db.query("SELECT * FROM audit_logs WHERE action='response.simulated' AND metadata->>'engine'='LOCAL'")).rows.length,1);
 }finally{await db.close();}
});
