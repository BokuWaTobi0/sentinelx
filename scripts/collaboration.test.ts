import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import type {QueryResultRow} from 'pg';
import type {SqlClient} from '../src/lib/sql-client';
import {applyMigrations} from '../src/lib/migrations';
import {addIncidentNote,assignIncident,incidentHistory} from '../src/lib/collaboration';
import {can} from '../src/lib/rbac';
import type {Role} from '../src/lib/rbac';

function adapter(db:PGlite):SqlClient{return {async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(values===undefined){await db.exec(sql);return {rows:[] as Row[]};}return db.query<Row>(sql,values);}};}
test('collaboration validates roles and active assignees, detects stale writes, and atomically audits append-only notes',async()=>{
 const db=new PGlite();const client=adapter(db);try{await applyMigrations(client);const users:Record<string,{id:string;role:Role}>={};for(const role of ['VIEWER','ANALYST','ANALYST','ADMIN'] as Role[]){const ix=Object.keys(users).length;const {rows:[u]}=await db.query<{id:string}>("INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,'unused',$3) RETURNING id",[`user${ix}@test.invalid`,`User ${ix}`,role]);users[role+(ix?'_'+ix:'') ]={id:u.id,role};}const viewer=Object.values(users).find(v=>v.role==='VIEWER')!,analysts=Object.values(users).filter(v=>v.role==='ANALYST');const incident=(await db.query<{id:string}>("INSERT INTO alerts(title,rule_id,severity) VALUES ('Case','rule','MEDIUM') RETURNING id")).rows[0];
  await assert.rejects(assignIncident(client,viewer,{incidentId:incident.id,assigneeId:analysts[0].id,expectedAssigneeId:''}),/Viewers/);
  await assert.rejects(assignIncident(client,analysts[0],{incidentId:incident.id,assigneeId:viewer.id,expectedAssigneeId:''}),/active user with the Analyst role/);
  await db.query("UPDATE users SET disabled=true WHERE id=$1",[analysts[1].id]);await assert.rejects(assignIncident(client,analysts[0],{incidentId:incident.id,assigneeId:analysts[1].id,expectedAssigneeId:''}),/active user with the Analyst role/);await db.query("UPDATE users SET disabled=false WHERE id=$1",[analysts[1].id]);
  const failingAssignment:SqlClient={async query(sql,values){if(sql.includes('INSERT INTO audit_logs'))throw new Error('Injected audit failure');return client.query(sql,values);}};await assert.rejects(assignIncident(failingAssignment,analysts[0],{incidentId:incident.id,assigneeId:analysts[1].id,expectedAssigneeId:''}),/Injected audit failure/);assert.equal((await db.query<{assigned_to:string|null}>('SELECT assigned_to FROM alerts WHERE id=$1',[incident.id])).rows[0].assigned_to,null);assert.equal((await db.query('SELECT * FROM incident_history')).rows.length,0);
  await assignIncident(client,analysts[0],{incidentId:incident.id,assigneeId:analysts[1].id,expectedAssigneeId:''});assert.equal((await db.query<{assigned_to:string}>('SELECT assigned_to FROM alerts WHERE id=$1',[incident.id])).rows[0].assigned_to,analysts[1].id);
  await assert.rejects(assignIncident(client,analysts[0],{incidentId:incident.id,assigneeId:analysts[0].id,expectedAssigneeId:''}),/changed since you opened/);
  await assignIncident(client,analysts[0],{incidentId:incident.id,assigneeId:'',expectedAssigneeId:analysts[1].id});
  await assert.rejects(addIncidentNote(client,analysts[0],{incidentId:incident.id,note:'   '}));await assert.rejects(addIncidentNote(client,analysts[0],{incidentId:incident.id,note:'x'.repeat(2001)}));
  const failing:SqlClient={async query(sql,values){if(sql.includes('INSERT INTO audit_logs'))throw new Error('Injected audit failure');return client.query(sql,values);}};await assert.rejects(addIncidentNote(failing,analysts[0],{incidentId:incident.id,note:'This must roll back with its audit record.'}),/Injected audit failure/);assert.equal((await db.query("SELECT * FROM incident_history WHERE action='NOTE_ADDED'")).rows.length,0);
  await addIncidentNote(client,analysts[0],{incidentId:incident.id,note:'Reviewed the event sequence; continue monitoring.'});await addIncidentNote(client,analysts[0],{incidentId:incident.id,note:'Second append-only note.'});
  const page1=await incidentHistory(client,incident.id,undefined,1);assert.equal(page1.items.length,1);assert.equal(page1.hasMore,true);const page2=await incidentHistory(client,incident.id,page1.next??undefined,1);assert.equal(page2.items.length,1);assert.notEqual(page1.items[0].id,page2.items[0].id);assert.equal('metadata' in page1.items[0],false);assert.equal(can('VIEWER','alerts:read'),true);assert.equal(can('VIEWER','audit:read'),false);assert.equal((await db.query<{count:number}>("SELECT count(*)::int AS count FROM audit_logs WHERE action='incident.assignment_changed'")).rows[0].count,2);
  assert.equal((await db.query('SELECT * FROM audit_logs WHERE target_id=$1',[incident.id])).rows.length,4);assert.equal((await db.query('SELECT * FROM incident_history WHERE incident_id=$1',[incident.id])).rows.length,4);
 }finally{await db.close();}
});
