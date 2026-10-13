import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {parseAlertFilters,searchRecord,alertFilterValues,alertSearchSql,evidenceIds,evidenceEventsSql,relatedAlertsSql,eventSearchSql,timeSeconds,parseRelatedTimelineFilters,relatedTimelineSql,relatedTimelineValues,RELATED_TIMELINE_PAGE_SIZE} from '../src/lib/investigation';
import {parseFilters} from '../src/lib/event-schema';
import {applyMigrations} from '../src/lib/migrations';
import type {SqlClient} from '../src/lib/sql-client';
import type {QueryResultRow} from 'pg';
async function database(run:(db:PGlite)=>Promise<void>){const db=new PGlite();try{const client:SqlClient={async query<Row extends QueryResultRow>(sql:string,values?:unknown[]){if(values===undefined){await db.exec(sql);return {rows:[] as Row[]};}return db.query<Row>(sql,values);}};await applyMigrations(client);await run(db);}finally{await db.close();}}
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
 const all=await db.query<{total_matches:number}>(alertSearchSql,alertFilterValues({time:'all'}));assert.equal(all.rows.length,25);assert.equal(all.rows[0].total_matches,106);
 const match=await db.query<{title:string}>(alertSearchSql,alertFilterValues({actor:'target',status:'ACKNOWLEDGED',severity:'HIGH',time:'7d'}));assert.equal(match.rows.length,1);assert.equal(match.rows[0].title,'Old target');
 assert.equal((await db.query(alertSearchSql,alertFilterValues({actor:'target',time:'24h'}))).rows.length,0);
}));
test('priority filters, score sorting and stable bounded pagination',async()=>database(async db=>{
 for(let i=0;i<61;i++){const band=i%2?'HIGH':'LOW';await db.query(`INSERT INTO alerts(title,rule_id,severity,evidence,priority_score,priority_band) VALUES ($1,'rule','LOW','{}',$2,$3)`,[`rank-${i}`,i%2?80:10,band]);}
 const first=await db.query<{title:string;total_matches:number}>(alertSearchSql,alertFilterValues({time:'all',priority:'HIGH',sort:'priority',page:1}));assert.equal(first.rows.length,25);assert.equal(first.rows[0].title,'rank-59');assert.equal(first.rows[0].total_matches,30);
 const second=await db.query<{title:string}>(alertSearchSql,alertFilterValues({time:'all',priority:'HIGH',sort:'priority',page:2}));assert.equal(second.rows.length,5);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.title)).size,30);
 assert.equal(parseAlertFilters({priority:'UNKNOWN'}).success,false);assert.equal(parseAlertFilters({page:'201'}).success,false);
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
test('related timeline filters validate actor, IP, time range, paired cursor and bounded pages',()=>{
 assert.equal(parseRelatedTimelineFilters(new URLSearchParams('actor=alice&sourceIp=192.0.2.5&time=24h')).success,true);
 assert.equal(parseRelatedTimelineFilters(new URLSearchParams('sourceIp=invalid')).success,false);
 assert.equal(parseRelatedTimelineFilters(new URLSearchParams('time=forever')).success,false);
 assert.equal(parseRelatedTimelineFilters(new URLSearchParams('page=201')).success,false);
 assert.equal(parseRelatedTimelineFilters(new URLSearchParams('actor=a&actor=b')).success,false);
 assert.equal(parseRelatedTimelineFilters(new URLSearchParams('afterId='+randomUUID())).success,false);
});
test('related event query filters actor/IP/time and uses bounded stable keyset pages excluding snapshot evidence',async()=>database(async db=>{
 const evidenceIds:string[]=[];
 for(let i=0;i<123;i++){
  const id=randomUUID();if(i===10||i===80)evidenceIds.push(id);
  const age=i===122?'2 days':`${i} seconds`;
  await db.query(`INSERT INTO events(id,occurred_at,source,event_type,actor,source_ip) VALUES ($1,now()-$2::interval,'test',$3,$4,$5::inet)`,[id,age,i%2?'LOGIN_SUCCESS':'LOGIN_FAILURE',i%2?'alice':'bob',i%3?'192.0.2.20':'192.0.2.21']);
 }
 const filters=parseRelatedTimelineFilters(new URLSearchParams('time=all&page=1'));assert.equal(filters.success,true);if(!filters.success)return;
 const first=(await db.query<{id:string;occurred_at:Date}>(relatedTimelineSql,relatedTimelineValues(evidenceIds,filters.data))).rows;
 assert.equal(first.length,RELATED_TIMELINE_PAGE_SIZE+1);
 const page1=first.slice(0,RELATED_TIMELINE_PAGE_SIZE);assert.equal(page1.some(row=>evidenceIds.includes(row.id)),false);
 const last=page1.at(-1)!;const nextFilters={...filters.data,page:2,afterOccurredAt:new Date(last.occurred_at).toISOString(),afterId:last.id};
 const second=(await db.query<{id:string;occurred_at:Date}>(relatedTimelineSql,relatedTimelineValues(evidenceIds,nextFilters))).rows;
 assert.equal(second.length,RELATED_TIMELINE_PAGE_SIZE+1);const page2=second.slice(0,RELATED_TIMELINE_PAGE_SIZE);assert.ok(new Date(page2[0].occurred_at)>=new Date(last.occurred_at));
 assert.equal(new Set([...page1,...page2].map(row=>row.id)).size,page1.length+page2.length);
 const matching=parseRelatedTimelineFilters(new URLSearchParams('actor=alice&sourceIp=192.0.2.20&time=24h&page=1'));assert.equal(matching.success,true);if(!matching.success)return;
 const matched=await db.query<{actor:string;source_ip:string;occurred_at:Date}>(relatedTimelineSql,relatedTimelineValues(evidenceIds,matching.data));
 assert.ok(matched.rows.length>0);assert.ok(matched.rows.every(row=>row.actor==='alice'&&row.source_ip==='192.0.2.20'&&Date.now()-new Date(row.occurred_at).getTime()<86400000));
}));
