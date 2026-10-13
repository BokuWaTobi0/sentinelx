import type { SqlClient } from './sql-client';
import { enqueueAutomation } from './automation';
import { scoreIncident } from './risk-score';
import { defaultDetectionRules,type DetectionConfig,type DetectionRules,DETECTION_LOCK } from './detection-config';
import {notifyActiveViewers} from './notifications';

export const LOGIN_BURST_RULE='failed-login-burst-v1';
export const PASSWORD_SPRAY_RULE='password-spray-v1';
export const IP_FAILURES_ACROSS_ACTORS_RULE='ip-failures-across-actors-v1';
export const SUCCESS_AFTER_BURST_RULE='success-after-failure-burst-v1';
export {DETECTION_LOCK};
export const THRESHOLD=5;
export const WINDOW_SECONDS=60;
export const PASSWORD_SPRAY_ACTORS=5;
export const PASSWORD_SPRAY_WINDOW_SECONDS=300;
export const IP_FAILURES_THRESHOLD=10;
export const IP_FAILURES_ACTORS=2;
export const IP_FAILURES_WINDOW_SECONDS=600;
export const SUCCESS_LOOKBACK_SECONDS=300;
export const DEFAULT_DETECTION_CONFIG:DetectionConfig={version:1,rules:defaultDetectionRules as unknown as DetectionRules};

// Each inserted event creates candidate event-time anchors, including later existing
// anchors. This lets late events complete a window without scanning wall-clock buckets.
export const candidateWindowsSql=`WITH changed AS (
 SELECT actor,occurred_at FROM events WHERE id=ANY($1::uuid[]) AND event_type='LOGIN_FAILURE'
), anchors AS (
 SELECT DISTINCT a.id,a.actor,a.occurred_at FROM events a JOIN changed c
 ON a.actor=c.actor AND a.occurred_at BETWEEN c.occurred_at AND c.occurred_at+($2::int*interval '1 second')
 WHERE a.event_type='LOGIN_FAILURE'
)
SELECT a.id AS anchor_id,a.actor,a.occurred_at AS window_end,
 w.failure_count,w.first_failure_at,w.last_failure_at,w.source_ips,w.event_ids,w.all_demo
FROM anchors a CROSS JOIN LATERAL (
 SELECT count(*)::int AS failure_count,min(e.occurred_at) AS first_failure_at,max(e.occurred_at) AS last_failure_at,
 array_agg(DISTINCT host(e.source_ip)) FILTER (WHERE e.source_ip IS NOT NULL) AS source_ips,
 (array_agg(e.id ORDER BY e.occurred_at,e.id))[1:100] AS event_ids,
 bool_and(COALESCE(e.payload->'demo'='true'::jsonb,false)) AS all_demo
 FROM events e WHERE e.actor=a.actor AND e.event_type='LOGIN_FAILURE'
 AND e.occurred_at BETWEEN a.occurred_at-($2::int*interval '1 second') AND a.occurred_at
) w WHERE w.failure_count>=$3::int ORDER BY a.actor,a.occurred_at DESC,a.id DESC`;

export const passwordSprayCandidatesSql=`WITH changed AS (
 SELECT source_ip,occurred_at FROM events WHERE id=ANY($1::uuid[]) AND event_type='LOGIN_FAILURE' AND source_ip IS NOT NULL
), anchors AS (
 SELECT DISTINCT e.id AS anchor_id,e.source_ip,e.occurred_at FROM events e JOIN changed c
 ON e.source_ip=c.source_ip AND e.event_type='LOGIN_FAILURE' AND e.occurred_at BETWEEN c.occurred_at AND c.occurred_at+($2::int*interval '1 second')
)
SELECT a.anchor_id,host(a.source_ip) AS source_ip,a.occurred_at AS window_end,w.failure_count,w.actor_count,w.actors,w.event_ids,w.first_failure_at,w.last_failure_at,w.all_demo
FROM anchors a CROSS JOIN LATERAL (
 SELECT count(*)::int AS failure_count,count(DISTINCT e.actor)::int AS actor_count,
 array_agg(DISTINCT e.actor ORDER BY e.actor) FILTER (WHERE e.actor IS NOT NULL) AS actors,
 (array_agg(e.id ORDER BY e.occurred_at,e.id))[1:100] AS event_ids,
 min(e.occurred_at) AS first_failure_at,max(e.occurred_at) AS last_failure_at,
 bool_and(COALESCE(e.payload->'demo'='true'::jsonb,false)) AS all_demo
 FROM events e WHERE e.source_ip=a.source_ip AND e.event_type='LOGIN_FAILURE'
 AND e.occurred_at BETWEEN a.occurred_at-($2::int*interval '1 second') AND a.occurred_at
) w WHERE w.failure_count>=$3::int AND w.actor_count>=$4::int ORDER BY a.source_ip,a.occurred_at DESC,a.anchor_id DESC`;

export const ipFailuresAcrossActorsCandidatesSql=`WITH changed AS (
 SELECT source_ip,occurred_at FROM events WHERE id=ANY($1::uuid[]) AND event_type='LOGIN_FAILURE' AND source_ip IS NOT NULL
), anchors AS (
 SELECT DISTINCT e.id AS anchor_id,e.source_ip,e.occurred_at FROM events e JOIN changed c
 ON e.source_ip=c.source_ip AND e.event_type='LOGIN_FAILURE' AND e.occurred_at BETWEEN c.occurred_at AND c.occurred_at+($2::int*interval '1 second')
)
SELECT a.anchor_id,host(a.source_ip) AS source_ip,a.occurred_at AS window_end,w.failure_count,w.actor_count,w.actors,w.event_ids,w.first_failure_at,w.last_failure_at,w.all_demo
FROM anchors a CROSS JOIN LATERAL (
 SELECT count(*)::int AS failure_count,count(DISTINCT e.actor)::int AS actor_count,
 array_agg(DISTINCT e.actor ORDER BY e.actor) FILTER (WHERE e.actor IS NOT NULL) AS actors,
 (array_agg(e.id ORDER BY e.occurred_at,e.id))[1:100] AS event_ids,
 min(e.occurred_at) AS first_failure_at,max(e.occurred_at) AS last_failure_at,
 bool_and(COALESCE(e.payload->'demo'='true'::jsonb,false)) AS all_demo
 FROM events e WHERE e.source_ip=a.source_ip AND e.event_type='LOGIN_FAILURE'
 AND e.occurred_at BETWEEN a.occurred_at-($2::int*interval '1 second') AND a.occurred_at
) w WHERE w.failure_count>=$3::int AND w.actor_count>=$4::int ORDER BY a.source_ip,a.occurred_at DESC,a.anchor_id DESC`;

export const successAfterBurstCandidatesSql=`WITH changed AS (
 SELECT id,actor,event_type,occurred_at FROM events WHERE id=ANY($1::uuid[])
), successes AS (
 SELECT DISTINCT s.id AS success_id,s.actor,s.source_ip,s.occurred_at AS success_at,COALESCE(s.payload->'demo'='true'::jsonb,false) AS success_demo
 FROM events s JOIN changed c ON (
  (c.id=s.id AND s.event_type='LOGIN_SUCCESS') OR
  (c.event_type='LOGIN_FAILURE' AND s.event_type='LOGIN_SUCCESS' AND s.actor=c.actor
   AND s.occurred_at>c.occurred_at AND s.occurred_at<=c.occurred_at+($3::int*interval '1 second'))
 )
 WHERE s.event_type='LOGIN_SUCCESS' AND s.actor IS NOT NULL
), burst AS (
 SELECT s.*,b.burst_end,b.event_ids,b.source_ips,b.first_failure_at,b.last_failure_at,b.failure_count,b.failures_demo
 FROM successes s JOIN LATERAL (
  SELECT a.occurred_at AS burst_end,x.event_ids,x.source_ips,x.first_failure_at,x.last_failure_at,x.failure_count,x.failures_demo
  FROM events a CROSS JOIN LATERAL (
   SELECT count(*)::int AS failure_count,(array_agg(f.id ORDER BY f.occurred_at,f.id))[1:100] AS event_ids,
    array_agg(DISTINCT host(f.source_ip)) FILTER (WHERE f.source_ip IS NOT NULL) AS source_ips,
    min(f.occurred_at) AS first_failure_at,max(f.occurred_at) AS last_failure_at,
    bool_and(COALESCE(f.payload->'demo'='true'::jsonb,false)) AS failures_demo
   FROM events f WHERE f.actor=s.actor AND f.event_type='LOGIN_FAILURE'
    AND f.occurred_at BETWEEN a.occurred_at-($2::int*interval '1 second') AND a.occurred_at
  ) x
  WHERE a.actor=s.actor AND a.event_type='LOGIN_FAILURE' AND a.occurred_at<s.success_at
   AND a.occurred_at>=s.success_at-($3::int*interval '1 second') AND x.failure_count>=$4::int
  ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1
 ) b ON true
)
SELECT success_id AS anchor_id,actor,source_ip,success_at AS window_end,burst_end,event_ids,source_ips,first_failure_at,last_failure_at,failure_count,(success_demo AND failures_demo) AS all_demo
FROM burst ORDER BY actor,success_at DESC,success_id DESC`;

type BurstCandidate={anchor_id:string;actor:string;window_end:Date|string;failure_count:number;first_failure_at:Date|string;last_failure_at:Date|string;source_ips:string[]|null;event_ids:string[];all_demo:boolean};
type IpCandidate={anchor_id:string;source_ip:string;window_end:Date|string;failure_count:number;actor_count:number;actors:string[]|null;event_ids:string[];first_failure_at:Date|string;last_failure_at:Date|string;all_demo:boolean};
type SuccessCandidate={anchor_id:string;actor:string;source_ip:string|null;window_end:Date|string;burst_end:Date|string;event_ids:string[];source_ips:string[]|null;first_failure_at:Date|string;last_failure_at:Date|string;failure_count:number;all_demo:boolean};
const iso=(value:Date|string)=>new Date(value).toISOString();
const ipGroup=(ip:string)=>`ip:${ip}`;
const actorGroup=(actor:string)=>`actor:${actor}`;

async function isSuppressed(client:SqlClient,ruleId:string,groupKey:string,end:string,seconds:number){
 const {rows}=await client.query(`SELECT 1 FROM detection_cooldowns WHERE rule_id=$1 AND group_key=$2
  AND window_end BETWEEN $3::timestamptz-($4::int*interval '1 second') AND $3::timestamptz+($4::int*interval '1 second') LIMIT 1`,[ruleId,groupKey,end,seconds]);
 if(rows.length)return true;
 // Preserve historical failed-login cooldowns created before migration 005.
 if(ruleId===LOGIN_BURST_RULE){
  const {rows:legacy}=await client.query(`SELECT 1 FROM detection_windows WHERE rule_id=$1 AND actor=$2
   AND window_end BETWEEN $3::timestamptz-interval '60 seconds' AND $3::timestamptz+interval '60 seconds' LIMIT 1`,[ruleId,groupKey.slice(6),end]);
  return legacy.length>0;
 }
 return false;
}

async function recordIncident(client:SqlClient,input:{ruleId:string;groupKey:string;anchorId:string;title:string;severity:'HIGH';evidence:Record<string,unknown>;actor?:string|null;windowEnd:string;cooldownSeconds:number;configVersion:number}){
 if(await isSuppressed(client,input.ruleId,input.groupKey,input.windowEnd,input.cooldownSeconds))return null;
 const score=scoreIncident(input.evidence);
 const {rows:[created]}=await client.query<{id:string}>(`INSERT INTO alerts(event_id,title,rule_id,severity,evidence,priority_score,priority_band,scoring_version,score_factors,scored_at,detection_config_version)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $6::int IS NULL THEN NULL ELSE now() END,$10) RETURNING id`,[input.anchorId,input.title,input.ruleId,input.severity,JSON.stringify(input.evidence),score?.score??null,score?.band??null,score?.version??null,score?JSON.stringify(score.factors):null,input.configVersion]);
 await client.query('INSERT INTO detection_cooldowns(rule_id,group_key,window_end,alert_id) VALUES ($1,$2,$3,$4)',[input.ruleId,input.groupKey,input.windowEnd,created.id]);
 if(input.ruleId===LOGIN_BURST_RULE&&input.actor)await client.query('INSERT INTO detection_windows(rule_id,actor,window_end,alert_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',[input.ruleId,input.actor,input.windowEnd,created.id]);
 await client.query("INSERT INTO audit_logs(action,target_id,metadata) VALUES ('alert.detected',$1,$2)",[created.id,JSON.stringify({ruleId:input.ruleId,groupKey:input.groupKey,...input.evidence})]);
 await notifyActiveViewers(client,{incidentId:created.id,kind:'INCIDENT_NEW',title:'New incident detected',message:input.title,dedupeKey:`incident:${created.id}:new`});
 const evidence=input.evidence;
 const actor=typeof evidence.actor==='string'?evidence.actor:undefined;
 const sourceIps=Array.isArray(evidence.sourceIps)?evidence.sourceIps:typeof evidence.sourceIp==='string'?[evidence.sourceIp]:[];
 await enqueueAutomation(client,created.id,'INVESTIGATE',{ruleId:input.ruleId,actor,failureCount:typeof evidence.failureCount==='number'?evidence.failureCount:typeof evidence.eventCount==='number'?evidence.eventCount:0,sourceIps,windowSeconds:typeof evidence.windowSeconds==='number'?evidence.windowSeconds:undefined,summary:evidence.explanation,demo:evidence.demo===true,actors:evidence.actors});
 return created.id;
}

export async function detectLoginBursts(client:SqlClient,changedIds:string[],config:DetectionConfig=DEFAULT_DETECTION_CONFIG):Promise<string[]> {
 if(!changedIds.length)return [];const rule=config.rules[LOGIN_BURST_RULE];if(!rule.enabled)return [];
 const candidates=await client.query<BurstCandidate>(candidateWindowsSql,[changedIds,rule.windowSeconds,rule.failureThreshold]);const alerts:string[]=[];
 for(const c of candidates.rows){
  const end=iso(c.window_end),start=iso(new Date(new Date(end).getTime()-rule.windowSeconds*1000));
  const evidence={detector:LOGIN_BURST_RULE,ruleConfigVersion:config.version,actor:c.actor,failureCount:c.failure_count,threshold:rule.failureThreshold,windowSeconds:rule.windowSeconds,windowStart:start,windowEnd:end,firstFailureAt:iso(c.first_failure_at),lastFailureAt:iso(c.last_failure_at),sourceIps:c.source_ips??[],eventIds:c.event_ids,evidenceTruncated:c.failure_count>c.event_ids.length,demo:c.all_demo,explanation:`Suspicious pattern: ${c.failure_count} failed login events for actor label ${c.actor} in an inclusive ${rule.windowSeconds}-second window; threshold is ${rule.failureThreshold}. Actor labels are not verified identities.`};
  const id=await recordIncident(client,{ruleId:LOGIN_BURST_RULE,groupKey:actorGroup(c.actor),anchorId:c.anchor_id,title:`Suspicious pattern: repeated login failures for ${c.actor}`,severity:'HIGH',evidence,actor:c.actor,windowEnd:end,cooldownSeconds:rule.cooldownSeconds,configVersion:config.version});if(id)alerts.push(id);
 }
 return alerts;
}

async function detectIpCandidates(client:SqlClient,changedIds:string[],ruleId:typeof PASSWORD_SPRAY_RULE|typeof IP_FAILURES_ACROSS_ACTORS_RULE,sql:string,kind:'spray'|'repeated',config:DetectionConfig){
 const rule=kind==='spray'?config.rules[PASSWORD_SPRAY_RULE]:config.rules[IP_FAILURES_ACROSS_ACTORS_RULE];if(!rule.enabled)return [];
 const failureThreshold=rule.failureThreshold,actorThreshold=rule.distinctActorThreshold;
 const candidates=await client.query<IpCandidate>(sql,[changedIds,rule.windowSeconds,failureThreshold,actorThreshold]);const alerts:string[]=[];
 for(const c of candidates.rows){
  const end=iso(c.window_end);const evidence={detector:ruleId,ruleConfigVersion:config.version,sourceIp:c.source_ip,actors:c.actors??[],actorCount:c.actor_count,failureCount:c.failure_count,eventCount:c.failure_count,threshold:failureThreshold,distinctActorThreshold:actorThreshold,windowSeconds:rule.windowSeconds,windowStart:iso(new Date(new Date(end).getTime()-rule.windowSeconds*1000)),windowEnd:end,firstFailureAt:iso(c.first_failure_at),lastFailureAt:iso(c.last_failure_at),eventIds:c.event_ids,evidenceTruncated:c.failure_count>c.event_ids.length,demo:c.all_demo,explanation:kind==='spray'?`Suspicious pattern: source IP ${c.source_ip} produced failed logins for ${c.actor_count} distinct actor labels in an inclusive ${rule.windowSeconds}-second window (threshold ${failureThreshold} failures and ${actorThreshold} labels). These labels are not verified identities.`:`Suspicious pattern: source IP ${c.source_ip} produced ${c.failure_count} failed logins across ${c.actor_count} distinct actor labels in an inclusive ${rule.windowSeconds}-second window (threshold ${failureThreshold} failures and ${actorThreshold} labels). These labels are not verified identities.`};
  const id=await recordIncident(client,{ruleId,groupKey:ipGroup(c.source_ip),anchorId:c.anchor_id,title:kind==='spray'?`Suspicious password spraying pattern from ${c.source_ip}`:`Suspicious repeated failures from ${c.source_ip}`,severity:'HIGH',evidence,windowEnd:end,cooldownSeconds:rule.cooldownSeconds,configVersion:config.version});if(id)alerts.push(id);
 }
 return alerts;
}

async function detectSuccessAfterBurst(client:SqlClient,changedIds:string[],config:DetectionConfig){
 const rule=config.rules[SUCCESS_AFTER_BURST_RULE];if(!rule.enabled)return [];
 const candidates=await client.query<SuccessCandidate>(successAfterBurstCandidatesSql,[changedIds,rule.failureWindowSeconds,rule.lookbackSeconds,rule.failureThreshold]);const alerts:string[]=[];
 for(const c of candidates.rows){
  const end=iso(c.window_end),burstEnd=iso(c.burst_end);const evidence={detector:SUCCESS_AFTER_BURST_RULE,ruleConfigVersion:config.version,actor:c.actor,successEventId:c.anchor_id,successAt:end,burstEnd,failureCount:c.failure_count,threshold:rule.failureThreshold,windowSeconds:rule.failureWindowSeconds,lookbackSeconds:rule.lookbackSeconds,failureWindowStart:iso(new Date(new Date(burstEnd).getTime()-rule.failureWindowSeconds*1000)),failureWindowEnd:burstEnd,firstFailureAt:iso(c.first_failure_at),lastFailureAt:iso(c.last_failure_at),sourceIps:c.source_ips??[],eventIds:[...c.event_ids,c.anchor_id].slice(0,100),evidenceTruncated:c.event_ids.length>=100,demo:c.all_demo,explanation:`Suspicious pattern: a successful login for actor label ${c.actor} followed a burst of ${c.failure_count} failed logins within ${rule.lookbackSeconds} seconds. The burst threshold is ${rule.failureThreshold} in ${rule.failureWindowSeconds} seconds. Actor labels are not verified identities.`};
  const id=await recordIncident(client,{ruleId:SUCCESS_AFTER_BURST_RULE,groupKey:actorGroup(c.actor),anchorId:c.anchor_id,title:`Suspicious successful login after failures for ${c.actor}`,severity:'HIGH',evidence,actor:c.actor,windowEnd:end,cooldownSeconds:rule.cooldownSeconds,configVersion:config.version});if(id)alerts.push(id);
 }
 return alerts;
}

// Caller holds DETECTION_LOCK in the surrounding transaction. Missing legacy IPs
// are excluded from IP rules; ingestion rejects malformed or missing sourceIp values.
export async function detectSecurityPatterns(client:SqlClient,changedIds:string[],config:DetectionConfig=DEFAULT_DETECTION_CONFIG):Promise<string[]> {
 if(!changedIds.length)return [];
 const ids=[
  ...await detectLoginBursts(client,changedIds,config),
  ...await detectIpCandidates(client,changedIds,PASSWORD_SPRAY_RULE,passwordSprayCandidatesSql,'spray',config),
  ...await detectIpCandidates(client,changedIds,IP_FAILURES_ACROSS_ACTORS_RULE,ipFailuresAcrossActorsCandidatesSql,'repeated',config),
  ...await detectSuccessAfterBurst(client,changedIds,config),
 ];
 return ids;
}
