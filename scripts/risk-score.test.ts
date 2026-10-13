import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {scoreIncident,priorityBand,SCORING_VERSION} from '../src/lib/risk-score';
const evidence=(patch:Record<string,unknown>={})=>({detector:'failed-login-burst-v1',failureCount:5,eventIds:['evidence-id'],actor:'label',sourceIps:['192.0.2.1'],...patch});
test('priority score factors are deterministic, capped and avoid duplicate count factors',()=>{
 const small=scoreIncident(evidence())!;assert.equal(small.score,20);assert.equal(small.band,'LOW');assert.equal(small.version,SCORING_VERSION);assert.deepEqual(small,scoreIncident(evidence()));assert.equal(small.factors.length,3);
 const large=scoreIncident(evidence({failureCount:1000,actorCount:20,sourceIps:['192.0.2.1','192.0.2.2']}))!;assert.equal(large.score,75);assert.equal(large.factors.find(f=>f.key==='failure_volume')?.points,30);assert.equal(large.factors.find(f=>f.key==='distinct_context')?.points,25);
 const success=scoreIncident(evidence({detector:'success-after-failure-burst-v1',failureCount:5}))!;assert.equal(success.score,50);assert.ok(success.factors.some(f=>f.key==='success_after_failures'&&f.points===25));
});
test('priority band boundaries and score cap are explicit',()=>{assert.equal(priorityBand(0),'LOW');assert.equal(priorityBand(29),'LOW');assert.equal(priorityBand(30),'MEDIUM');assert.equal(priorityBand(59),'MEDIUM');assert.equal(priorityBand(60),'HIGH');assert.equal(priorityBand(79),'HIGH');assert.equal(priorityBand(80),'CRITICAL');assert.equal(priorityBand(100),'CRITICAL');const score=scoreIncident(evidence({failureCount:10000,actorCount:100,sourceIps:Array.from({length:8},(_,i)=>`192.0.2.${i+1}`),detector:'success-after-failure-burst-v1'}))!;assert.equal(score.score,100);});
test('insufficient or unknown immutable evidence remains unscored',()=>{assert.equal(scoreIncident({}),null);assert.equal(scoreIncident(evidence({eventIds:[]})),null);assert.equal(scoreIncident(evidence({failureCount:0})),null);assert.equal(scoreIncident(evidence({detector:'unknown'})),null);});
test('score version and factor explanation persist once; conditional backfill is idempotent',async()=>{
 const db=new PGlite();try{await db.exec(await readFile('db/migrations/001_init.sql','utf8'));await db.exec(await readFile('db/migrations/007_day10_risk_live.sql','utf8'));
 const score=scoreIncident(evidence())!;const inserted=await db.query<{id:string}>(`INSERT INTO alerts(title,rule_id,severity,evidence,priority_score,priority_band,scoring_version,score_factors,scored_at) VALUES ('incident','failed-login-burst-v1','HIGH',$1,$2,$3,$4,$5,now()) RETURNING id`,[JSON.stringify(evidence()),score.score,score.band,score.version,JSON.stringify(score.factors)]);const id=inserted.rows[0].id;
 const first=await db.query(`UPDATE alerts SET priority_score=$1,priority_band=$2,scoring_version=$3,score_factors=$4,scored_at=now() WHERE id=$5 AND priority_score IS NULL`,[80,'CRITICAL','priority-v2','[]',id]);assert.equal(first.rowCount,0);
 await db.query(`UPDATE alerts SET status='RESOLVED' WHERE id=$1`,[id]);const stored=await db.query<{priority_score:number;priority_band:string;scoring_version:string;score_factors:{key:string}[]}>(`SELECT priority_score,priority_band,scoring_version,score_factors FROM alerts WHERE id=$1`,[id]);assert.equal(stored.rows[0].priority_score,20);assert.equal(stored.rows[0].priority_band,'LOW');assert.equal(stored.rows[0].scoring_version,SCORING_VERSION);assert.equal(stored.rows[0].score_factors[0].key,'detection_rule');
 }finally{await db.close();}
});
test('live update endpoint guards all requests and never selects restricted audit payloads',async()=>{
 const source=await readFile('src/app/api/updates/route.ts','utf8');assert.match(source,/currentUser\(\)/);assert.match(source,/can\(user\.role,'alerts:read'\)/);assert.match(source,/can\(user\.role,'events:read'\)/);assert.doesNotMatch(source,/audit_logs|metadata/);assert.match(source,/Cache-Control/);
});
test('polling pauses on hidden tabs, aborts navigation, backs off, and refreshes without replacing input components',async()=>{
 const client=await readFile('src/components/live-updates.tsx','utf8'),history=await readFile('src/components/incident-collaboration.tsx','utf8');
 assert.match(client,/document\.hidden/);assert.match(client,/60000/);assert.match(client,/AbortController/);assert.match(client,/controller\.current\?\.abort\(\)/);assert.match(client,/Math\.min\(backoff\.current\*2,120000\)/);assert.match(client,/New incidents available/);assert.match(client,/router\.refresh\(\)/);
 assert.match(history,/name="note"[^>]*placeholder=/);assert.match(history,/useState\(initialItems\)/);assert.match(history,/setItems\(current=>/);
});
