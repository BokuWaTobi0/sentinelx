import type { SqlClient } from './sql-client';
import { enqueueAutomation } from './automation';
export const LOGIN_BURST_RULE='failed-login-burst-v1';
export const DETECTION_LOCK=81422;
export const THRESHOLD=5;
export const WINDOW_SECONDS=60;
// Anchor at event timestamps, not wall-clock buckets. Include existing anchors after
// newly inserted failures so late/out-of-order events can complete a prior window.
export const candidateWindowsSql=`WITH changed AS (
 SELECT actor,occurred_at FROM events WHERE id=ANY($1::uuid[]) AND event_type='LOGIN_FAILURE'
), anchors AS (
 SELECT DISTINCT a.id,a.actor,a.occurred_at FROM events a JOIN changed c
 ON a.actor=c.actor AND a.occurred_at BETWEEN c.occurred_at AND c.occurred_at+interval '60 seconds'
 WHERE a.event_type='LOGIN_FAILURE'
)
SELECT a.id AS anchor_id,a.actor,a.occurred_at AS window_end,
 w.failure_count,w.first_failure_at,w.last_failure_at,w.source_ips,w.event_ids,w.all_demo
FROM anchors a CROSS JOIN LATERAL (
 SELECT count(*)::int AS failure_count,min(e.occurred_at) AS first_failure_at,max(e.occurred_at) AS last_failure_at,
 array_agg(DISTINCT host(e.source_ip)) AS source_ips,
 (array_agg(e.id ORDER BY e.occurred_at,e.id))[1:100] AS event_ids,
 bool_and(COALESCE(e.payload->'demo'='true'::jsonb,false)) AS all_demo
 FROM events e WHERE e.actor=a.actor AND e.event_type='LOGIN_FAILURE'
 AND e.occurred_at BETWEEN a.occurred_at-interval '60 seconds' AND a.occurred_at
) w WHERE w.failure_count>=5 ORDER BY a.actor,a.occurred_at DESC,a.id DESC`;
type Candidate={anchor_id:string;actor:string;window_end:Date|string;failure_count:number;first_failure_at:Date|string;last_failure_at:Date|string;source_ips:string[];event_ids:string[];all_demo:boolean};
const iso=(value:Date|string)=>new Date(value).toISOString();
export async function detectLoginBursts(client:SqlClient,changedIds:string[]):Promise<string[]> {
 // Caller must hold DETECTION_LOCK within its transaction before any event writes.
 if(!changedIds.length) return [];
 const candidates=await client.query<Candidate>(candidateWindowsSql,[changedIds]);
 const alerts:string[]=[];
 for(const candidate of candidates.rows){
  const end=iso(candidate.window_end);
  const suppressed=await client.query(`SELECT alert_id FROM detection_windows WHERE rule_id=$1 AND actor=$2
   AND window_end BETWEEN $3::timestamptz-interval '60 seconds' AND $3::timestamptz+interval '60 seconds' LIMIT 1`,[LOGIN_BURST_RULE,candidate.actor,end]);
  if(suppressed.rows.length) continue;
  const evidence={detector:LOGIN_BURST_RULE,actor:candidate.actor,failureCount:candidate.failure_count,threshold:THRESHOLD,windowSeconds:WINDOW_SECONDS,
   windowStart:iso(new Date(new Date(end).getTime()-WINDOW_SECONDS*1000)),windowEnd:end,
   firstFailureAt:iso(candidate.first_failure_at),lastFailureAt:iso(candidate.last_failure_at),
   sourceIps:candidate.source_ips,eventIds:candidate.event_ids,evidenceTruncated:candidate.failure_count>candidate.event_ids.length,
   demo:candidate.all_demo,explanation:`${candidate.failure_count} failed login events for ${candidate.actor} in an inclusive 60-second window; threshold is 5.`};
  const created=await client.query<{id:string}>(`INSERT INTO alerts(event_id,title,rule_id,severity,evidence)
   VALUES ($1,$2,$3,'HIGH',$4) RETURNING id`,[candidate.anchor_id,`Repeated login failures: ${candidate.actor}`,LOGIN_BURST_RULE,JSON.stringify(evidence)]);
  const id=created.rows[0].id;
  await client.query('INSERT INTO detection_windows(rule_id,actor,window_end,alert_id) VALUES ($1,$2,$3,$4)',[LOGIN_BURST_RULE,candidate.actor,end,id]);
  await client.query(`INSERT INTO audit_logs(action,target_id,metadata) VALUES ('alert.detected',$1,$2)`,[id,JSON.stringify({ruleId:LOGIN_BURST_RULE,actor:candidate.actor,failureCount:candidate.failure_count,windowEnd:end,demo:candidate.all_demo})]);
  await enqueueAutomation(client,id,'INVESTIGATE',{actor:candidate.actor,failureCount:candidate.failure_count,sourceIps:candidate.source_ips,windowSeconds:WINDOW_SECONDS,evidenceTruncated:evidence.evidenceTruncated,demo:candidate.all_demo});
  alerts.push(id);
 }
 return alerts;
}
