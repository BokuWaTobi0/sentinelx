import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../src/lib/migrations';
import { ingestEvents } from '../src/lib/ingest-events';
import { detectLoginBursts,detectSecurityPatterns,DETECTION_LOCK,LOGIN_BURST_RULE,PASSWORD_SPRAY_RULE,IP_FAILURES_ACROSS_ACTORS_RULE,SUCCESS_AFTER_BURST_RULE } from '../src/lib/detector';
import { eventRecords,insertEventsSql } from '../src/lib/event-sql';
import type { SecurityEvent } from '../src/lib/event-schema';
import type { SqlClient } from '../src/lib/sql-client';
import type { QueryResultRow } from 'pg';
// node-postgres uses the simple protocol for unparameterized migration SQL.
// PGlite.query always prepares; use exec for those migration statements.
function migrationClient(db:PGlite):SqlClient {
 return {async query<Row extends QueryResultRow>(text:string,values?:unknown[]){
  if(values===undefined){await db.exec(text);return {rows:[] as Row[]};}
  return db.query<Row>(text,values);
 }};
}
const base=Date.parse('2026-10-10T00:00:00Z');
function failure(actor:string,offset:number):SecurityEvent {
 return {id:randomUUID(),occurredAt:new Date(base+offset).toISOString(),source:'test',eventType:'LOGIN_FAILURE',actor,sourceIp:'192.0.2.50',payload:{demo:true}};
}
const burst=(actor='target',start=0,count=8)=>Array.from({length:count},(_,i)=>failure(actor,start+i*3000));
async function withDatabase(run:(db:PGlite)=>Promise<void>){
 const db=new PGlite();
 try {await applyMigrations(migrationClient(db));await run(db);} finally {await db.close();}
}
async function replay(db:PGlite,ids:string[]){
 await db.query('BEGIN');
 try {
  await db.query('SELECT pg_advisory_xact_lock($1)',[DETECTION_LOCK]);
  const alerts=await detectLoginBursts(db,ids);
  await db.query('COMMIT');
  return alerts;
 } catch(error){await db.query('ROLLBACK');throw error;}
}
function sharedIpFailure(actor:string,offset:number,ip='203.0.113.7'):SecurityEvent{return {...failure(actor,offset),sourceIp:ip};}
test('threshold crosses across requests and success events do not count',async()=>withDatabase(async db=>{
 const four=burst('target',0,4);
 assert.equal((await ingestEvents(db,four)).alertsCreated,0);
 const success={...failure('target',12000),eventType:'LOGIN_SUCCESS' as const};
 assert.equal((await ingestEvents(db,[success])).alertsCreated,0);
 assert.equal((await ingestEvents(db,[failure('target',15000)])).alertsCreated,1);
}));
test('an eight-event burst creates one explained HIGH alert and retry is idempotent',async()=>withDatabase(async db=>{
 const events=burst();
 const result=await ingestEvents(db,events);
 assert.equal(result.accepted,8);assert.equal(result.alertsCreated,1);
 const {rows:[alert]}=await db.query<{severity:string;status:string;rule_id:string;evidence:Record<string,unknown>}>('SELECT severity,status,rule_id,evidence FROM alerts');
 assert.equal(alert.severity,'HIGH');assert.equal(alert.status,'OPEN');assert.equal(alert.rule_id,LOGIN_BURST_RULE);
 assert.equal(alert.evidence.failureCount,8);assert.equal(alert.evidence.threshold,5);assert.equal(alert.evidence.windowSeconds,60);
 assert.equal((alert.evidence.eventIds as string[]).length,8);assert.equal(alert.evidence.demo,true);
 const retry=await ingestEvents(db,events);
 assert.equal(retry.accepted,0);assert.equal(retry.duplicates,8);assert.equal(retry.alertsCreated,0);
 assert.equal((await db.query("SELECT * FROM audit_logs WHERE action='alert.detected'")).rows.length,1);
 assert.equal((await db.query("SELECT * FROM audit_logs WHERE action='events.ingested'")).rows.length,1);
}));
test('window boundary includes exactly 60 seconds and excludes 60.001 seconds',async()=>withDatabase(async db=>{
 const exact=[0,15000,30000,45000,60000].map(t=>failure('boundary',t));
 assert.equal((await ingestEvents(db,exact)).alertsCreated,1);
 const outside=[0,15000,30000,45000,60001].map(t=>({...failure('outside',t),sourceIp:'192.0.2.51'}));
 assert.equal((await ingestEvents(db,outside)).alertsCreated,0);
}));
test('different actors and widely spaced failures never combine',async()=>withDatabase(async db=>{
 const separate=[...burst('a',0,3),...burst('b',0,3)].map((event,i)=>({...event,sourceIp:`192.0.2.${100+i}`}));
 assert.equal((await ingestEvents(db,separate)).alertsCreated,0);
 assert.equal((await ingestEvents(db,[0,61000,122000,183000,244000].map((t,i)=>({...failure('slow',t),sourceIp:`192.0.2.${120+i}`})))).alertsCreated,0);
}));
test('actor correlation spans sources/IPs and preserves evidence identifiers',async()=>withDatabase(async db=>{
 const events=burst('distributed',0,5).map((event,i)=>({...event,source:`source-${i}`,sourceIp:`192.0.2.${10+i}`}));
 assert.equal((await ingestEvents(db,events)).alertsCreated,1);
 const {rows:[alert]}=await db.query<{evidence:{sourceIps:string[];eventIds:string[]}}>('SELECT evidence FROM alerts');
 assert.equal(alert.evidence.sourceIps.length,5);
 assert.deepEqual([...alert.evidence.eventIds].sort(),events.map(event=>event.id).sort());
}));
test('cooldown suppresses overlapping windows even after resolution; later burst alerts again',async()=>withDatabase(async db=>{
 const first=await ingestEvents(db,burst());assert.equal(first.alertsCreated,1);
 await db.query("UPDATE alerts SET status='RESOLVED'");
 assert.equal((await ingestEvents(db,burst('target',30000))).alertsCreated,0);
 assert.equal((await ingestEvents(db,burst('target',180000))).alertsCreated,1);
 assert.equal((await db.query('SELECT * FROM alerts')).rows.length,2);
}));
test('late arrival completes an existing window; replay adds no duplicate',async()=>withDatabase(async db=>{
 const existing=[10000,20000,30000,40000].map(t=>failure('late',t));
 assert.equal((await ingestEvents(db,existing)).alertsCreated,0);
 const late=failure('late',0);
 assert.equal((await ingestEvents(db,[late])).alertsCreated,1);
 assert.equal((await replay(db,[...existing,late].map(event=>event.id))).length,0);
}));
test('replay detects pre-Day-3 events once',async()=>withDatabase(async db=>{
 const events=burst('old-data');
 await db.query(insertEventsSql,[eventRecords(events)]);
 assert.equal((await replay(db,events.map(event=>event.id))).length,1);
 assert.equal((await replay(db,events.map(event=>event.id))).length,0);
}));
test('audit failure rolls back ingestion, alert and cooldown; lock is acquired before writes',async()=>withDatabase(async db=>{
 const calls:string[]=[];
 const client:SqlClient={async query(text,values){
  calls.push(text);
  if(text.includes("'alert.detected'")) throw new Error('Injected audit failure');
  return db.query(text,values);
 }};
 await assert.rejects(ingestEvents(client,burst()),/Injected audit failure/);
 assert.equal(calls[0],'BEGIN');assert.match(calls[1],/pg_advisory_xact_lock/);
 for(const table of ['events','alerts','audit_logs','detection_windows','detection_cooldowns','automation_jobs'])
  assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,0);
 assert.equal((await ingestEvents(db,burst())).alertsCreated,1);
}));
test('migration upgrades Day 1 without changing users and is safe to rerun',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile('db/migrations/001_init.sql','utf8'));
  await db.exec("CREATE TABLE schema_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now()); INSERT INTO schema_migrations(version) VALUES ('001_init');");
  await db.query("INSERT INTO users(email,name,password_hash,role) VALUES ('test@example.com','Test','preserve-this-hash','ADMIN')");
  await applyMigrations(migrationClient(db));await applyMigrations(migrationClient(db));
  assert.equal((await db.query('SELECT * FROM schema_migrations')).rows.length,6);
  const {rows:[user]}=await db.query<{password_hash:string}>('SELECT password_hash FROM users');
  assert.equal(user.password_hash,'preserve-this-hash');
  assert.equal((await db.query('SELECT * FROM detection_windows')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM detection_cooldowns')).rows.length,0);
 } finally {await db.close();}
});
test('password spraying requires five distinct actor labels within an inclusive five-minute window',async()=>withDatabase(async db=>{
 const atBoundary=[0,75000,150000,225000,300000].map((offset,i)=>sharedIpFailure(`label-${i}`,offset));
 assert.equal((await ingestEvents(db,atBoundary)).alertsCreated,1);
 const {rows:[alert]}=await db.query<{rule_id:string;evidence:Record<string,unknown>}>('SELECT rule_id,evidence FROM alerts');
 assert.equal(alert.rule_id,PASSWORD_SPRAY_RULE);assert.equal(alert.evidence.actorCount,5);assert.equal(alert.evidence.actors instanceof Array,true);
 assert.equal(alert.evidence.actor,undefined);assert.equal(alert.evidence.sourceIp,'203.0.113.7');
}));
test('password spraying excludes four actor labels and a window one millisecond too wide',async()=>withDatabase(async db=>{
 const fourActors=Array.from({length:5},(_,i)=>sharedIpFailure(`four-${i%4}`,i*1000,'203.0.113.8'));
 await ingestEvents(db,fourActors);
 const tooWide=[0,66666,133333,200000,266667].map((offset,i)=>sharedIpFailure(`wide-${i}`,offset,'203.0.113.9'));
 // The final offset is changed below to exceed the inclusive 5-minute boundary.
 tooWide[4]={...tooWide[4],occurredAt:new Date(base+300001).toISOString()};
 await ingestEvents(db,tooWide);
 assert.equal((await db.query("SELECT * FROM alerts WHERE rule_id=$1",[PASSWORD_SPRAY_RULE])).rows.length,0);
}));
test('IP-centered repeated failures need ten attempts across two labels in an inclusive ten-minute window',async()=>withDatabase(async db=>{
 const exact=Array.from({length:10},(_,i)=>sharedIpFailure(`ip-user-${i%2}`,Math.round(i*600000/9),'203.0.113.10'));
 await ingestEvents(db,exact);
 const {rows}=await db.query<{rule_id:string;evidence:Record<string,unknown>}>('SELECT rule_id,evidence FROM alerts WHERE rule_id=$1',[IP_FAILURES_ACROSS_ACTORS_RULE]);
 assert.equal(rows.length,1);assert.equal(rows[0].evidence.failureCount,10);assert.equal(rows[0].evidence.actorCount,2);assert.equal(rows[0].evidence.actor,undefined);
 const outside=Array.from({length:10},(_,i)=>sharedIpFailure(`outside-${i%2}`,Math.round(i*600001/9),'203.0.113.11'));
 await ingestEvents(db,outside);
 assert.equal((await db.query('SELECT * FROM alerts WHERE rule_id=$1',[IP_FAILURES_ACROSS_ACTORS_RULE])).rows.length,1);
}));
test('success after a qualifying failure burst is detected, including out-of-order failure delivery',async()=>withDatabase(async db=>{
 const success={...sharedIpFailure('success-label',61000,'203.0.113.12'),eventType:'LOGIN_SUCCESS' as const};
 const first=[0,15000,30000,45000,60000].map(t=>sharedIpFailure('success-label',t,'203.0.113.12'));
 await ingestEvents(db,[success,...first]);
 const {rows}=await db.query<{rule_id:string;evidence:Record<string,unknown>}>('SELECT rule_id,evidence FROM alerts WHERE rule_id=$1',[SUCCESS_AFTER_BURST_RULE]);
 assert.equal(rows.length,1);assert.equal(rows[0].evidence.actor,'success-label');assert.equal(rows[0].evidence.successEventId,success.id);
 assert.equal((rows[0].evidence.eventIds as string[]).length,6);
}));
test('success time limit includes exactly five minutes after a failure anchor and excludes five minutes plus one millisecond',async()=>withDatabase(async db=>{
 for(const [actor,successOffset,ip] of [['exact-success',360000,'203.0.113.30'],['late-success',360001,'203.0.113.31']] as const){
  const failures=[0,15000,30000,45000,60000].map(t=>sharedIpFailure(actor,t,ip));
  const success={...sharedIpFailure(actor,successOffset,ip),eventType:'LOGIN_SUCCESS' as const};
  await ingestEvents(db,[...failures,success]);
 }
 const {rows}=await db.query<{actor:string}>('SELECT evidence->>\'actor\' AS actor FROM alerts WHERE rule_id=$1',[SUCCESS_AFTER_BURST_RULE]);
 assert.deepEqual(rows.map(row=>row.actor),['exact-success']);
}));
test('IP-rule cooldowns suppress retries and overlapping windows but allow a later incident',async()=>withDatabase(async db=>{
 const makeSpray=(start:number)=>Array.from({length:5},(_,i)=>({...sharedIpFailure(`cooldown-${i}`,start+i*1000,'203.0.113.13'),occurredAt:new Date(base+start+i*1000).toISOString()}));
 const first=makeSpray(0);assert.equal((await ingestEvents(db,first)).alertsCreated,1);
 const duplicate=await ingestEvents(db,first);assert.equal(duplicate.accepted,0);assert.equal(duplicate.alertsCreated,0);
 assert.equal((await ingestEvents(db,makeSpray(60000))).alertsCreated,1); // The independent 10-failure IP rule now qualifies.
 assert.equal((await db.query('SELECT * FROM alerts WHERE rule_id=$1',[PASSWORD_SPRAY_RULE])).rows.length,1);
 assert.equal((await ingestEvents(db,makeSpray(600000))).alertsCreated,1);
 assert.equal((await db.query('SELECT * FROM alerts WHERE rule_id=$1',[PASSWORD_SPRAY_RULE])).rows.length,2);
 assert.equal((await db.query('SELECT * FROM alerts WHERE rule_id=$1',[IP_FAILURES_ACROSS_ACTORS_RULE])).rows.length,1);
}));
test('concurrent/retried ingestion is serialized before writes and cooldown uniqueness is durable',async()=>withDatabase(async db=>{
 const calls:string[]=[];const client:SqlClient={async query(text,values){calls.push(text);return db.query(text,values);}};
 const events=Array.from({length:5},(_,i)=>sharedIpFailure(`concurrent-${i}`,i*1000,'203.0.113.14'));
 const results=await Promise.all([ingestEvents(client,events),ingestEvents(client,events)]);
 assert.deepEqual(results.map(result=>result.accepted).sort(),[0,5]);
 assert.equal((await db.query('SELECT * FROM alerts WHERE rule_id=$1',[PASSWORD_SPRAY_RULE])).rows.length,1);
 assert.equal((await db.query<{total:number}>('SELECT count(*)::int AS total FROM detection_cooldowns')).rows[0].total,1);
}));
