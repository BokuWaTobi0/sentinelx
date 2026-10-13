import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {QueryResultRow} from 'pg';
import type {SqlClient} from '../src/lib/sql-client';
import {applyMigrations} from '../src/lib/migrations';
import {defaultDetectionRules,detectionRulesSchema,saveDetectionConfig,DetectionConfigConflict} from '../src/lib/detection-config';
import {ingestEvents} from '../src/lib/ingest-events';
import {parseImportBytes,previewImport,confirmImport} from '../src/lib/log-import';
import {notifyActiveViewers,notifyActiveAdmins,notifyActiveAnalyst} from '../src/lib/notifications';
import {assignIncident} from '../src/lib/collaboration';
import {can} from '../src/lib/rbac';

function adapter(db:PGlite):SqlClient{return {async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(values===undefined){if(/^\s*(SELECT|WITH|SHOW)\b/i.test(sql))return db.query<Row>(sql);await db.exec(sql);return {rows:[] as Row[]};}return db.query<Row>(sql,values);}};}
async function setup(){const db=new PGlite();const client=adapter(db);await applyMigrations(client);return {db,client,close:()=>db.close()};}
async function user(db:PGlite,role:'VIEWER'|'ANALYST'|'ADMIN',name=role){return (await db.query<{id:string}>('INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,\'unused\',$3) RETURNING id',[`${randomUUID()}@test.invalid`,name,role])).rows[0].id;}
const rules=()=>JSON.parse(JSON.stringify(defaultDetectionRules));
test('rule configuration is Admin-only, bounded, optimistic, audited, and applies prospectively',async()=>{const {db,client,close}=await setup();try{
 const admin=await user(db,'ADMIN');assert.equal(can('ANALYST','rules:manage'),false);assert.equal(can('ADMIN','rules:manage'),true);
 assert.match(await readFile('src/app/admin/rules-actions.ts','utf8'),/requirePermission\('rules:manage'\)/);
 const changed=rules();changed['failed-login-burst-v1'].failureThreshold=6;
 assert.throws(()=>detectionRulesSchema.parse({...rules(),'failed-login-burst-v1':{...rules()['failed-login-burst-v1'],windowSeconds:3}}));
 assert.throws(()=>detectionRulesSchema.parse({...rules(),'password-spray-v1':{...rules()['password-spray-v1'],distinctActorThreshold:7}}));
 assert.equal(await saveDetectionConfig(client,admin,1,changed),2);
 await assert.rejects(saveDetectionConfig(client,admin,1,rules()),DetectionConfigConflict);
 const prior=await db.query('SELECT detection_config_version FROM alerts');assert.equal(prior.rows.length,0);
 const now=Date.now(),events=Array.from({length:5},(_,i)=>({id:randomUUID(),occurredAt:new Date(now-30000+i*1000).toISOString(),source:'day11-test',eventType:'LOGIN_FAILURE' as const,actor:'prospective-target',sourceIp:'192.0.2.44',payload:{}}));
 assert.equal((await ingestEvents(client,events)).alertsCreated,0);
 const more=Array.from({length:2},(_,i)=>({...events[0],id:randomUUID(),occurredAt:new Date(now+1000+i*1000).toISOString()}));
 assert.equal((await ingestEvents(client,more)).alertsCreated,1);
 const {rows:[alert]}=await db.query<{detection_config_version:number}>('SELECT detection_config_version FROM alerts WHERE evidence->>\'actor\'=$1',['prospective-target']);assert.equal(alert.detection_config_version,2);
 assert.equal((await db.query<{n:number}>("SELECT count(*)::int AS n FROM audit_logs WHERE action='detection.configuration_updated'")).rows[0].n,1);
 }finally{await close();}});
test('import parses quoted CSV and JSON, previews without writes, preserves IDs, and exact retries deduplicate',async()=>{const {db,client,close}=await setup();try{
 const analyst=await user(db,'ANALYST');assert.equal(can('VIEWER','events:import'),false);assert.equal(can('ANALYST','events:import'),true);assert.match(await readFile('src/app/api/import/route.ts','utf8'),/can\(user\.role,'events:import'\)/);const now=Date.now();const csv=`id,occurredAt,source,eventType,actor,sourceIp,payload\n,"${new Date(now-1000).toISOString()}",test,LOGIN_SUCCESS,"user, one",192.0.2.9,"{""reason"":""hello, world""}"\n`;
 const bytes=new TextEncoder().encode(csv),preview=parseImportBytes(bytes,'events.csv',now);assert.equal(preview.accepted.length,1);assert.equal(preview.accepted[0].actor,'user, one');assert.equal(preview.accepted[0].payload.reason,'hello, world');
 const again=parseImportBytes(bytes,'events.csv',now);assert.equal(again.accepted[0].id,preview.accepted[0].id);
 const before=await db.query<{n:number}>('SELECT count(*)::int AS n FROM events');assert.equal((await previewImport(client,preview)).acceptedCount,1);assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM events')).rows[0].n,before.rows[0].n);
 const first=await confirmImport(client,analyst,preview),second=await confirmImport(client,analyst,again);assert.equal(first.acceptedCount,1);assert.equal(second.acceptedCount,0);assert.equal(second.duplicateCount,1);assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM events')).rows[0].n,1);
 assert.throws(()=>parseImportBytes(new TextEncoder().encode(JSON.stringify({unexpected:[]})),'events.json',now),/events array/);
 }finally{await close();}});
test('import rejects unsupported JSON and limits with safe row errors',()=>{const now=Date.now();assert.throws(()=>parseImportBytes(new TextEncoder().encode('{"unexpected":[]}'),'events.json',now),/events array/);assert.throws(()=>parseImportBytes(new Uint8Array(1024*1024+1),'x.csv',now),/1 MiB/);});
test('notifications route per-user active recipients, exclude requesters, and deduplicate',async()=>{const {db,client,close}=await setup();try{
 const viewer=await user(db,'VIEWER'),viewer2=await user(db,'VIEWER'),analyst=await user(db,'ANALYST'),admin=await user(db,'ADMIN'),incident=(await db.query<{id:string}>("INSERT INTO alerts(title,rule_id,severity) VALUES ('Notice test','test','HIGH') RETURNING id")).rows[0].id;
 await notifyActiveViewers(client,{incidentId:incident,kind:'INCIDENT_NEW',title:'New incident',message:'A new incident is available.',dedupeKey:'incident:new'});
 await notifyActiveViewers(client,{incidentId:incident,kind:'INCIDENT_NEW',title:'New incident',message:'A new incident is available.',dedupeKey:'incident:new'});
 await notifyActiveAdmins(client,{incidentId:incident,kind:'RESPONSE_REVIEW_REQUESTED',title:'Review requested',message:'Independent review requested.',dedupeKey:'response:1'},admin);
 await notifyActiveAnalyst(client,analyst,{incidentId:incident,kind:'ASSIGNED',title:'Assigned',message:'Assigned to you.',dedupeKey:'assign:1'});
 const own=(await db.query('SELECT * FROM notifications WHERE recipient_id=$1',[viewer])).rows;assert.equal(own.length,1);assert.equal((await db.query('SELECT * FROM notifications WHERE recipient_id=$1',[viewer2])).rows.length,1);assert.equal((await db.query('SELECT * FROM notifications WHERE recipient_id=$1',[admin])).rows.length,0);assert.equal((await db.query('SELECT * FROM notifications WHERE recipient_id=$1',[analyst])).rows.length,1);
 await db.query('UPDATE notifications SET read_at=now() WHERE recipient_id=$1',[viewer]);assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM notifications WHERE recipient_id=$1 AND read_at IS NULL',[viewer])).rows[0].n,0);assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM notifications WHERE recipient_id=$1 AND read_at IS NULL',[viewer2])).rows[0].n,1);
 const route=await readFile('src/app/api/notifications/route.ts','utf8'),updates=await readFile('src/app/api/updates/route.ts','utf8');assert.match(route,/n\.recipient_id=\$1/);assert.match(route,/recipient_id=\$2/);assert.match(updates,/notifications WHERE recipient_id=\$1/);assert.doesNotMatch(route,/audit_logs|metadata/);
 }finally{await close();}});
test('Admin assignment notice commits atomically with the assignment and goes only to the selected active Analyst',async()=>{const {db,client,close}=await setup();try{
 const admin=await user(db,'ADMIN'),analyst=await user(db,'ANALYST'),other=await user(db,'ANALYST'),incident=(await db.query<{id:string}>("INSERT INTO alerts(title,rule_id,severity) VALUES ('Assignment notice','test','HIGH') RETURNING id")).rows[0].id;
 const failNotification:SqlClient={async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(sql.includes('INSERT INTO notifications'))throw new Error('Injected notice failure');return client.query<Row>(sql,values);}};
 await assert.rejects(assignIncident(failNotification,{id:admin,role:'ADMIN'},{incidentId:incident,assigneeId:analyst,expectedAssigneeId:''}),/Injected notice failure/);
 assert.equal((await db.query<{assigned_to:string|null}>('SELECT assigned_to FROM alerts WHERE id=$1',[incident])).rows[0].assigned_to,null);assert.equal((await db.query('SELECT * FROM incident_history WHERE incident_id=$1',[incident])).rows.length,0);assert.equal((await db.query('SELECT * FROM notifications WHERE incident_id=$1',[incident])).rows.length,0);
 await assignIncident(client,{id:admin,role:'ADMIN'},{incidentId:incident,assigneeId:analyst,expectedAssigneeId:''});
 assert.equal((await db.query('SELECT * FROM notifications WHERE recipient_id=$1 AND incident_id=$2',[analyst,incident])).rows.length,1);assert.equal((await db.query('SELECT * FROM notifications WHERE recipient_id=$1 AND incident_id=$2',[other,incident])).rows.length,0);
 }finally{await close();}});
