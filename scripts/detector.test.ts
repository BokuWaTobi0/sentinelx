import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../src/lib/migrations';
import { ingestEvents } from '../src/lib/ingest-events';
import { detectLoginBursts,DETECTION_LOCK,LOGIN_BURST_RULE } from '../src/lib/detector';
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
 const outside=[0,15000,30000,45000,60001].map(t=>failure('outside',t));
 assert.equal((await ingestEvents(db,outside)).alertsCreated,0);
}));
test('different actors and widely spaced failures never combine',async()=>withDatabase(async db=>{
 assert.equal((await ingestEvents(db,[...burst('a',0,3),...burst('b',0,3)])).alertsCreated,0);
 assert.equal((await ingestEvents(db,[0,61000,122000,183000,244000].map(t=>failure('slow',t)))).alertsCreated,0);
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
 for(const table of ['events','alerts','audit_logs','detection_windows','automation_jobs'])
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
  assert.equal((await db.query('SELECT * FROM schema_migrations')).rows.length,4);
  const {rows:[user]}=await db.query<{password_hash:string}>('SELECT password_hash FROM users');
  assert.equal(user.password_hash,'preserve-this-hash');
  assert.equal((await db.query('SELECT * FROM detection_windows')).rows.length,0);
 } finally {await db.close();}
});
