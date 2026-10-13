import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBatch, parseFilters } from '../src/lib/event-schema';
import { readBoundedJson, MAX_BODY_BYTES, BodyTooLarge, validIngestToken } from '../src/lib/ingest-http';
const now=Date.parse('2026-10-10T00:00:00Z');
const good={id:'00000000-0000-4000-8000-000000000011',occurredAt:new Date(now).toISOString(),source:'test',eventType:'LOGIN_FAILURE',actor:'demo-target',sourceIp:'192.0.2.50',payload:{demo:true}};
test('validate batches, timestamps, IPs and structured payloads',()=>{
 assert.equal(parseBatch({events:[good]},now).success,true);
 assert.equal(parseBatch({events:[{...good,sourceIp:'garbage'}]},now).success,false);
 assert.equal(parseBatch({events:[{...good,sourceIp:undefined}]},now).success,false);
 assert.equal(parseBatch({events:[{...good,occurredAt:new Date(now+61000).toISOString()}]},now).success,false);
 assert.equal(parseBatch({events:[{...good,occurredAt:new Date(now-8*86400000).toISOString()}]},now).success,false);
 assert.equal(parseBatch({events:[{...good,eventType:'UNKNOWN'}]},now).success,false);
 assert.equal(parseBatch({events:[{...good,payload:{password:'secret'}}]},now).success,false);
 for(const scenario of ['normal','login-burst','password-spray','ip-failures','success-after-burst'] as const)assert.equal(parseBatch({events:[{...good,payload:{demo:true,scenario}}]},now).success,true);
 assert.equal(parseBatch({events:[]},now).success,false);
 assert.equal(parseBatch({events:Array(101).fill(good)},now).success,false);
 assert.equal(parseFilters(new URLSearchParams('eventType=UNKNOWN')).success,false);
});
test('ingestion token rejects missing, invalid and mismatched credentials',()=>{
 const key='a'.repeat(64);
 assert.equal(validIngestToken(`Bearer ${key}`,key),true);
 assert.equal(validIngestToken(`Bearer ${'b'.repeat(64)}`,key),false);
 assert.equal(validIngestToken(null,key),false);
 assert.equal(validIngestToken(`Bearer ${key}`,undefined),false);
 assert.equal(validIngestToken('Bearer short','short'),false);
});
test('bounded JSON rejects oversized streamed bodies and malformed JSON',async()=>{
 assert.deepEqual(await readBoundedJson(new Request('http://localhost',{method:'POST',body:'{"ok":true}'})),{ok:true});
 await assert.rejects(readBoundedJson(new Request('http://localhost',{method:'POST',body:'{bad'})),SyntaxError);
 await assert.rejects(readBoundedJson(new Request('http://localhost',{method:'POST',body:'x'.repeat(MAX_BODY_BYTES+1)})),BodyTooLarge);
});
