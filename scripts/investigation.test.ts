import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseAlertFilters,searchRecord,alertFilterValues,alertSearchSql,evidenceIds,evidenceEventsSql,relatedAlertsSql,eventSearchSql,timeSeconds} from '../src/lib/investigation';
import {parseFilters} from '../src/lib/event-schema';
async function database(run:(db:PGlite)=>Promise<void>){const db=new PGlite();try{await db.exec(await readFile('db/migrations/001_init.sql','utf8'));await run(db);}finally{await db.close();}}
test('filter validation rejects invalid enums, repeated keys and oversize fields',()=>{
 assert.equal(parseAlertFilters({}).success,true);
 assert.equal(parseAlertFilters({status:'BAD'}).success,false);
 assert.equal(parseAlertFilters({severity:'URGENT'}).success,false);
 assert.equal(parseAlertFilters({time:'forever'}).success,false);
 assert.equal(parseAlertFilters({actor:'a'.repeat(129)}).success,false);
 assert.equal(parseAlertFilters(searchRecord(new URLSearchParams('status=OPEN&status=RESOLVED'))).success,false);
 assert.equal(parseFilters(new URLSearchParams('time=24h')).success,true);
 assert.equal(parseFilters(new URLSearchParams('time=nope')).success,false);
 assert.equal(parseFilters(new URLSearchParams('actor=a&actor=b')).success,false);
 assert.equal(timeSeconds('7d'),604800);
});
test('server filters can find an incident outside the latest 100 and return full matching count',async()=>database(async db=>{
 await db.query(`INSERT INTO alerts(title,rule_id,severity,status,evidence,created_at) SELECT 'Recent '||n,'rule','LOW','OPEN','{}',now() FROM generate_series(1,105) n`);
 await db.query(`INSERT INTO alerts(title,rule_id,severity,status,evidence,created_at) VALUES ('Old target','rule','HIGH','ACKNOWLEDGED','{"actor":"target"}',now()-interval '2 days')`);
 const all=await db.query<{total_matches:number}>(alertSearchSql,alertFilterValues({time:'all'}));assert.equal(all.rows.length,100);assert.equal(all.rows[0].total_matches,106);
 const match=await db.query<{title:string}>(alertSearchSql,alertFilterValues({actor:'target',status:'ACKNOWLEDGED',severity:'HIGH',time:'7d'}));assert.equal(match.rows.length,1);assert.equal(match.rows[0].title,'Old target');
 assert.equal((await db.query(alertSearchSql,alertFilterValues({actor:'target',time:'24h'}))).rows.length,0);
}));
test('incident text search treats input literally, including wildcard and SQL-looking text',async()=>database(async db=>{
 await db.query(`INSERT INTO alerts(title,rule_id,severity,evidence) VALUES ('Percent 100%','rule','HIGH','{"actor":"a"}'),('Ordinary','rule','LOW','{}')`);
 assert.equal((await db.query(alertSearchSql,alertFilterValues({q:'%',time:'all'}))).rows.length,1);
 assert.equal((await db.query(alertSearchSql,alertFilterValues({q:"' OR 1=1 --",time:'all'}))).rows.length,0);
}));
test('snapshot references normalize, deduplicate, reject invalid IDs and cap at 100',()=>{
 const id='a1234567-1234-4123-8123-123456789abc';const result=evidenceIds({eventIds:[id,id.toUpperCase(),'bad',12]});
 assert.deepEqual(result.ids,[id]);assert.equal(result.invalid,2);
 assert.deepEqual(evidenceIds({demo:true}).ids,[]);
 const capped=evidenceIds({eventIds:Array.from({length:105},()=>randomUUID())});assert.equal(capped.ids.length,100);assert.equal(capped.omitted,5);
});
test('evidence timeline includes only exact snapshot events in chronological order; linked incidents require exact membership',async()=>database(async db=>{
 const ids=Array.from({length:3},()=>randomUUID());
 for(let i=0;i<3;i++)await db.query(`INSERT INTO events(id,occurred_at,source,event_type,actor,source_ip) VALUES ($1,now()+make_interval(secs=>$2),'test','LOGIN_FAILURE','same-actor','192.0.2.1')`,[ids[i],i]);
 const timeline=await db.query<{id:string}>(evidenceEventsSql,[[ids[1],ids[0]]]);assert.deepEqual(timeline.rows.map(e=>e.id),[ids[0],ids[1]]);
 await db.query(`INSERT INTO alerts(title,rule_id,severity,evidence) VALUES ('Exact','rule','HIGH',$1),('Same actor but unrelated','rule','HIGH','{"actor":"same-actor"}')`,[JSON.stringify({actor:'same-actor',eventIds:[ids[0]]})]);
 const linked=await db.query<{title:string}>(relatedAlertsSql,[ids[0],ids[0]]);assert.deepEqual(linked.rows.map(a=>a.title),['Exact']);
 assert.equal((await db.query(relatedAlertsSql,[ids[2],ids[2]])).rows.length,0);
 assert.equal((await db.query(evidenceEventsSql,[[randomUUID()]])).rows.length,0);
}));
test('telemetry time filters use occurrence time rather than ingestion time',async()=>database(async db=>{
 await db.query(`INSERT INTO events(occurred_at,source,event_type,actor) VALUES (now()-interval '3 days','test','LOGIN_FAILURE','target'),(now(),'test','LOGIN_SUCCESS','target')`);
 assert.equal((await db.query(eventSearchSql,['target',null,86400])).rows.length,1);
 assert.equal((await db.query(eventSearchSql,['target',null,604800])).rows.length,2);
 assert.equal((await db.query(eventSearchSql,['target','LOGIN_FAILURE',86400])).rows.length,0);
}));
