import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResultRow } from 'pg';
import type { SqlClient } from '../src/lib/sql-client';
import { applyMigrations } from '../src/lib/migrations';
import { ingestEvents } from '../src/lib/ingest-events';
import { claimAutomation,settleAutomation,retryAutomation,validateAutomationResult,type AutomationJob } from '../src/lib/automation';
import { windmillConfig,runWindmill,WindmillError } from '../src/lib/windmill';
import { automationProvider,runLocal } from '../src/lib/automation-provider';
function report(job:AutomationJob){return {jobId:job.id,incidentId:job.incident_id,kind:'INVESTIGATE',engine:'WINDMILL',realWorldChanges:false,summary:'Evidence snapshot reviewed.',recommendation:'Verify events before containment.',failureCount:8,sourceIpCount:1};}
test('durable auto-queue, retry leases, stale workers, terminal failures and atomic audit',async()=>{
 const db=new PGlite();
 const adapter:SqlClient={async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(values===undefined){await db.exec(sql);return {rows:[] as Row[]};}return db.query<Row>(sql,values);}};
 try{
  await applyMigrations(adapter);await applyMigrations(adapter);
  const events=Array.from({length:8},(_,i)=>({id:randomUUID(),occurredAt:new Date(Date.parse('2026-10-10T00:00:00Z')+i*1000).toISOString(),source:'test',eventType:'LOGIN_FAILURE' as const,actor:'day6-demo',sourceIp:'192.0.2.10',payload:{demo:true}}));
  await ingestEvents(db,events);await ingestEvents(db,events);
  assert.equal((await db.query('SELECT * FROM automation_jobs')).rows.length,1);
  const first=await claimAutomation(db);assert.ok(first);assert.equal(first.attempts,1);
  assert.equal(await claimAutomation(db),null);
  await db.query("UPDATE automation_jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[first.id]);
  const recovered=await claimAutomation(db);assert.ok(recovered);assert.equal(recovered.attempts,2);assert.notEqual(recovered.lease_token,first.lease_token);
  assert.equal(await settleAutomation(db,first,{result:report(first)}),false);
  assert.throws(()=>validateAutomationResult(recovered,{...report(recovered),incidentId:randomUUID()}));
  assert.throws(()=>validateAutomationResult(recovered,{...report(recovered),realWorldChanges:true}));
  await settleAutomation(db,recovered,{errorCode:'HTTP_503',retryable:true});
  assert.equal(await claimAutomation(db),null);
  await db.query('UPDATE automation_jobs SET next_attempt_at=now() WHERE id=$1',[first.id]);
  const third=await claimAutomation(db);assert.ok(third);
  const failing:SqlClient={async query(sql,values){if(sql.includes('INSERT INTO audit_logs'))throw new Error('Injected audit failure');return db.query(sql,values);}};
  await assert.rejects(settleAutomation(failing,third,{result:report(third)}),/Injected audit failure/);
  assert.equal((await db.query<{status:string}>('SELECT status FROM automation_jobs WHERE id=$1',[first.id])).rows[0].status,'RUNNING');
  await settleAutomation(db,third,{result:report(third)});
  assert.equal(await settleAutomation(db,third,{result:report(third)}),false);
  assert.equal((await db.query("SELECT * FROM audit_logs WHERE action='automation.completed'")).rows.length,1);
  // Terminal jobs can be deliberately requeued, with permissions checked afresh.
  await db.query("UPDATE automation_jobs SET status='FAILED',result=NULL,finished_at=now() WHERE id=$1",[first.id]);
  const {rows:[viewer]}=await db.query<{id:string}>("INSERT INTO users(email,name,password_hash,role) VALUES ('v@test.invalid','Viewer','unused','VIEWER') RETURNING id");
  await assert.rejects(retryAutomation(db,viewer.id,first.id),/Only active Analysts/);
  await db.query("UPDATE users SET role='ANALYST' WHERE id=$1",[viewer.id]);
  await retryAutomation(db,viewer.id,first.id);
  const retried=await claimAutomation(db);assert.ok(retried);assert.equal(retried.attempts,1);
  await settleAutomation(db,retried,{errorCode:'HTTP_401',retryable:false});
  assert.equal((await db.query<{status:string}>('SELECT status FROM automation_jobs WHERE id=$1',[first.id])).rows[0].status,'FAILED');
  await retryAutomation(db,viewer.id,first.id);
  await db.query("UPDATE automation_jobs SET status='RUNNING',attempts=5,lease_token=$1,lease_expires_at=now()-interval '1 second' WHERE id=$2",[randomUUID(),first.id]);
  assert.equal(await claimAutomation(db),null);
  assert.equal((await db.query<{error_code:string}>('SELECT error_code FROM automation_jobs WHERE id=$1',[first.id])).rows[0].error_code,'LEASE_EXHAUSTED');
 }finally{await db.close();}
});
test('Windmill configuration requires a sync flow endpoint and keeps secrets out of URL',()=>{
 assert.throws(()=>windmillConfig({}),/NOT_CONFIGURED/);
 for(const url of ['http://example.com/api/w/demo/jobs/run_wait_result/f/f/test','https://example.com/api/w/demo/jobs/run/f/f/test','https://example.com/api/w/demo/jobs/run_wait_result/f/f/test?token=secret','https://user:secret@example.com/api/w/demo/jobs/run_wait_result/f/f/test'])assert.throws(()=>windmillConfig({WINDMILL_WEBHOOK_URL:url,WINDMILL_TOKEN:'token'}),/INVALID_WEBHOOK_URL/);
 assert.equal(windmillConfig({WINDMILL_WEBHOOK_URL:'https://app.windmill.dev/api/w/demo/jobs/run_wait_result/f/f/sentinelx/incident',WINDMILL_TOKEN:'token'}).token,'token');
});
test('provider selection defaults to local, rejects unknown values, and local execution uses only the queued snapshot',async()=>{
 assert.equal(automationProvider({}), 'local');assert.equal(automationProvider({AUTOMATION_PROVIDER:'windmill'}),'windmill');
 assert.throws(()=>automationProvider({AUTOMATION_PROVIDER:'other'}),/INVALID_AUTOMATION_PROVIDER/);
 const job={id:randomUUID(),incident_id:randomUUID(),response_id:null,kind:'INVESTIGATE',status:'RUNNING',payload:{actor:'snapshot-actor',failureCount:8,sourceIps:['192.0.2.4']},result:null,attempts:1,lease_token:randomUUID(),error_code:null,created_at:new Date(),finished_at:null} satisfies AutomationJob;
 const result=await runLocal(job);assert.equal(result.engine,'LOCAL');assert.equal(result.kind,'INVESTIGATE');if(result.kind!=='INVESTIGATE')throw new Error('Expected local investigation result');assert.match(result.summary,/snapshot-actor/);assert.equal(result.failureCount,8);assert.equal(result.sourceIpCount,1);
 assert.throws(()=>validateAutomationResult(job,{...result,engine:'WINDMILL'},'local'),/RESULT_PROVIDER_MISMATCH/);
});
test('local simulated containment requires an independent approval and honestly records LOCAL',async()=>{
 const job={id:randomUUID(),incident_id:randomUUID(),response_id:randomUUID(),kind:'CONTAIN_SIMULATED',status:'RUNNING',payload:{actor:'approved-actor',approved:true,requestedBy:randomUUID(),approvedBy:randomUUID()},result:null,attempts:1,lease_token:randomUUID(),error_code:null,created_at:new Date(),finished_at:null} satisfies AutomationJob;
 await assert.rejects(runLocal(job),/APPROVAL_INVALID/);
 await assert.rejects(runLocal({...job,payload:{...job.payload,approvedBy:job.payload.requestedBy}}),/APPROVAL_INVALID/);
 await assert.rejects(runLocal({...job,payload:{...job.payload,approved:false}}),/APPROVAL_INVALID/);
});
test('real HTTP adapter authenticates, bounds responses and rejects Windmill errors or mismatched results',async()=>{
 const job={id:randomUUID(),incident_id:randomUUID(),kind:'INVESTIGATE',payload:{actor:'demo'},response_id:null,status:'RUNNING',result:null,attempts:1,lease_token:randomUUID(),error_code:null,created_at:new Date(),finished_at:null} satisfies AutomationJob;
 let mode='ok';
 const server=createServer(async(req,res)=>{
  assert.equal(req.headers.authorization,'Bearer test-token');
  let body='';for await(const part of req)body+=part;
  assert.deepEqual(JSON.parse(body),{payload:job.payload});
  if(mode==='unauthorized'){res.writeHead(401);res.end('secret should not be logged');return;}
  if(mode==='oversized'){res.end('x'.repeat(66000));return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mode==='mismatch'?{...report(job),jobId:randomUUID()}:mode==='windmill-error'?{error:'Python execution failed'}:report(job)));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const config=windmillConfig({WINDMILL_WEBHOOK_URL:`http://127.0.0.1:${address.port}/api/w/demo/jobs/run_wait_result/f/f/test`,WINDMILL_TOKEN:'test-token'});
  assert.equal((await runWindmill(job,config)).jobId,job.id);
  mode='unauthorized';await assert.rejects(runWindmill(job,config),(error:unknown)=>error instanceof WindmillError&&error.code==='HTTP_401'&&!error.retryable);
  mode='mismatch';await assert.rejects(runWindmill(job,config),/INVALID_RESULT/);
  mode='windmill-error';await assert.rejects(runWindmill(job,config),/INVALID_RESULT/);
  mode='oversized';await assert.rejects(runWindmill(job,config),/INVALID_RESULT_BODY/);
  await assert.rejects(runWindmill(job,config,async()=>{throw new Error('Network gone');}),(error:unknown)=>error instanceof WindmillError&&error.retryable);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('included two-step Windmill flow executes investigation and approval checks locally',async(t)=>{
 const flow=JSON.parse(await readFile('windmill/sentinelx.flow.json','utf8'));
 assert.equal(flow.value.modules.length,2);
 for(const [index,name] of ['validate','execute'].entries())assert.equal(flow.value.modules[index].value.content,await readFile(`windmill/${name}.py`,'utf8'));
 const base={jobId:randomUUID(),incidentId:randomUUID(),actor:'day6-demo',kind:'INVESTIGATE',failureCount:8,sourceIps:['192.0.2.10'],windowSeconds:60};
 const candidates=process.platform==='win32'?[['python'],['py','-3'],['python3']]:[['python3']];
 const python=candidates.find(([command,...args])=>{
  const probe=spawnSync(command,[...args,'-c','import sys; sys.exit(0 if sys.version_info.major == 3 else 1)'],{encoding:'utf8',timeout:5000});
  return !probe.error&&probe.status===0;
 });
 if(!python){t.skip('Optional local Python flow check; Windmill provides its own Python runtime.');return;}
 const [command,...args]=python;
 const run=(payload:unknown)=>spawnSync(command,[...args,'-c',"import json,sys,runpy; validate=runpy.run_path('windmill/validate.py')['main']; execute=runpy.run_path('windmill/execute.py')['main']; print(json.dumps(execute(validate(json.load(sys.stdin)))))"],{input:JSON.stringify(payload),encoding:'utf8'});
 const reportResult=run(base);assert.equal(reportResult.status,0,reportResult.stderr);assert.match(JSON.parse(reportResult.stdout).summary,/8 failed logins/);
 const requester=randomUUID(),approver=randomUUID();
 const approved={...base,kind:'CONTAIN_SIMULATED',responseId:randomUUID(),approved:true,requestedBy:requester,approvedBy:approver};
 const result=run(approved);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).realWorldChanges,false);
 assert.notEqual(run({...approved,approvedBy:requester}).status,0);
 assert.notEqual(run({...approved,approved:false}).status,0);
});
