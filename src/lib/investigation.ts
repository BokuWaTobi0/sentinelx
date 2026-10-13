import { z } from 'zod';
import { isIP } from 'node:net';
export const statusOptions=['OPEN','ACKNOWLEDGED','RESOLVED'] as const;
export const severityOptions=['LOW','MEDIUM','HIGH','CRITICAL'] as const;
export const timeOptions=['all','24h','7d'] as const;
const optional=<T extends z.ZodType>(schema:T)=>z.preprocess(value=>value===''?undefined:value,schema.optional());
export const alertFiltersSchema=z.object({
 status:optional(z.enum(statusOptions)),severity:optional(z.enum(severityOptions)),
 actor:optional(z.string().trim().max(128)),q:optional(z.string().trim().max(200)),
 time:z.preprocess(value=>value===''?undefined:value,z.enum(timeOptions).default('all')),
});
export type AlertFilters={status?:typeof statusOptions[number];severity?:typeof severityOptions[number];actor?:string;q?:string;time:typeof timeOptions[number]};
export function parseAlertFilters(input:Record<string,unknown>){return alertFiltersSchema.safeParse(input);}
export function searchRecord(params:URLSearchParams){
 const result:Record<string,unknown>={};
 for(const key of ['status','severity','actor','q','time','eventType']){
  const all=params.getAll(key);if(all.length) result[key]=all.length===1?all[0]:all;
 }
 return result;
}
export function timeSeconds(time:string){return time==='24h'?86400:time==='7d'?604800:null;}
export function alertFilterValues(filters:AlertFilters){return [filters.status??null,filters.severity??null,filters.actor||null,timeSeconds(filters.time),filters.q||null];}
export const alertSearchSql=`SELECT id,title,rule_id,severity,status,evidence,created_at,count(*) OVER()::int AS total_matches FROM alerts
 WHERE ($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR severity=$2)
 AND ($3::text IS NULL OR evidence->>'actor'=$3)
 AND ($4::int IS NULL OR created_at>=now()-make_interval(secs=>$4::int))
 AND ($5::text IS NULL OR strpos(lower(concat_ws(' ',title,rule_id,evidence->>'actor')),lower($5))>0)
 ORDER BY created_at DESC,id DESC LIMIT 100`;
export const evidenceEventsSql=`SELECT id,occurred_at,source,event_type,actor,host(source_ip) AS source_ip,payload,ingested_at
 FROM events WHERE id=ANY($1::uuid[]) ORDER BY occurred_at ASC,id ASC`;
export function evidenceIds(evidence:Record<string,unknown>){
 const raw=evidence.eventIds;
 if(!Array.isArray(raw))return {ids:[] as string[],invalid:0,omitted:0};
 const valid:string[]=[];let invalid=0;
 for(const id of raw){if(z.string().uuid().safeParse(id).success)valid.push((id as string).toLowerCase());else invalid++;}
 const unique=[...new Set(valid)];return {ids:unique.slice(0,100),invalid,omitted:Math.max(0,unique.length-100)};
}
export const uuidSchema=z.string().uuid();
export const relatedAlertsSql=`SELECT id,title,severity,status FROM alerts WHERE event_id=$1::uuid OR evidence->'eventIds' ? $2::text ORDER BY created_at DESC LIMIT 20`;

export const eventSearchSql=`SELECT id,occurred_at,source,event_type,actor,host(source_ip) AS source_ip,payload,ingested_at FROM events
 WHERE ($1::text IS NULL OR actor=$1) AND ($2::text IS NULL OR event_type=$2)
 AND ($3::int IS NULL OR occurred_at>=now()-make_interval(secs=>$3::int))
 ORDER BY occurred_at DESC,id DESC LIMIT 100`;

export const RELATED_TIMELINE_PAGE_SIZE=50;
export const relatedTimelineFiltersSchema=z.object({
 actor:optional(z.string().trim().max(128)),
 sourceIp:optional(z.string().trim().max(45).refine(value=>isIP(value)!==0,'Expected IPv4 or IPv6')),
 time:z.enum(['all','24h','7d']).default('all'),
 page:z.coerce.number().int().min(1).max(200).default(1),
 afterOccurredAt:optional(z.string().datetime({offset:true})),
 afterId:optional(z.string().uuid()),
}).superRefine((value,ctx)=>{
 const hasCursor=Boolean(value.afterOccurredAt&&value.afterId);
 if(Boolean(value.afterOccurredAt)!==Boolean(value.afterId)||(value.page===1&&hasCursor)||(value.page>1&&!hasCursor))ctx.addIssue({code:'custom',path:['afterId'],message:'A stable cursor is required after page one'});
});
export type RelatedTimelineFilters=z.infer<typeof relatedTimelineFiltersSchema>;
export function parseRelatedTimelineFilters(params:URLSearchParams){
 const input:Record<string,unknown>={};
 for(const key of ['actor','sourceIp','time','page','afterOccurredAt','afterId'] as const){const values=params.getAll(key);if(values.length>1)return {success:false as const};if(values.length)input[key]=values[0];}
 return relatedTimelineFiltersSchema.safeParse(input);
}
export const relatedTimelineSql=`SELECT id,occurred_at,event_type,actor,host(source_ip) AS source_ip,source,payload
 FROM events
 WHERE id<>ALL($1::uuid[])
 AND ($2::text IS NULL OR actor=$2)
 AND ($3::inet IS NULL OR source_ip=$3::inet)
 AND ($4::int IS NULL OR occurred_at>=now()-make_interval(secs=>$4::int))
 AND ($5::timestamptz IS NULL OR (occurred_at,id)>($5::timestamptz,$6::uuid))
 ORDER BY occurred_at ASC,id ASC LIMIT $7`;
export function relatedTimelineValues(evidenceEventIds:string[],filters:RelatedTimelineFilters){
 return [evidenceEventIds,filters.actor||null,filters.sourceIp||null,timeSeconds(filters.time),filters.afterOccurredAt??null,filters.afterId??null,RELATED_TIMELINE_PAGE_SIZE+1];
}
