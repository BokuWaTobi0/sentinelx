import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { insertEventsSql,eventRecords,listEventsSql } from '../src/lib/event-sql';
import type { SecurityEvent } from '../src/lib/event-schema';
test('event insertion is idempotent, filtered, and transactional in embedded PostgreSQL',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile('db/migrations/001_init.sql','utf8'));
  const event:SecurityEvent={id:'00000000-0000-4000-8000-000000000011',occurredAt:new Date().toISOString(),source:'test',eventType:'LOGIN_FAILURE',actor:'demo-target',sourceIp:'192.0.2.50',payload:{demo:true}};
  const first=await db.query(insertEventsSql,[eventRecords([event])]);
  assert.equal(first.rows.length,1);
  const retry=await db.query(insertEventsSql,[eventRecords([event])]);
  assert.equal(retry.rows.length,0);
  assert.equal((await db.query(listEventsSql,['demo-target','LOGIN_FAILURE'])).rows.length,1);
  assert.equal((await db.query(listEventsSql,['other',null])).rows.length,0);
  assert.equal((await db.query(listEventsSql,["' OR 1=1 --",null])).rows.length,0);
  await db.exec('BEGIN');
  await db.query(insertEventsSql,[eventRecords([{...event,id:'00000000-0000-4000-8000-000000000012'}])]);
  await db.query(`INSERT INTO audit_logs(action,metadata) VALUES ('events.ingested',$1)`,[JSON.stringify({accepted:1})]);
  await db.exec('ROLLBACK');
  assert.equal((await db.query(listEventsSql,[null,null])).rows.length,1);
  assert.equal((await db.query('SELECT * FROM audit_logs')).rows.length,0);
 } finally {await db.close();}
});
