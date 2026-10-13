import { z } from 'zod';
import { isIP } from 'node:net';
export const eventTypes = ['LOGIN_SUCCESS','LOGIN_FAILURE','PRIVILEGE_CHANGE'] as const;
export const eventSchema = z.object({
 id: z.string().uuid(),
 occurredAt: z.string().datetime({offset:true}),
 source: z.string().trim().min(1).max(64),
 eventType: z.enum(eventTypes),
 actor: z.string().trim().min(1).max(128),
 sourceIp: z.string().max(45).refine(value => isIP(value) !== 0, 'Expected IPv4 or IPv6'),
 payload: z.object({
  hostname: z.string().max(128).optional(),
  reason: z.string().max(256).optional(),
  demo: z.boolean().optional(),
  scenario: z.enum(['normal','login-burst','password-spray','ip-failures','success-after-burst']).optional(),
 }).strict().default({}),
}).strict();
export const batchSchema = z.object({events:z.array(eventSchema).min(1).max(100)}).strict();
export type SecurityEvent = z.infer<typeof eventSchema>;
export function parseBatch(body:unknown, now=Date.now()) {
 return batchSchema.superRefine(({events},ctx)=>{
  events.forEach((event,index)=>{
   const time=Date.parse(event.occurredAt);
   if(time < now-7*24*60*60*1000 || time > now+60*1000)
    ctx.addIssue({code:'custom',path:['events',index,'occurredAt'],message:'Timestamp must be within the past 7 days and at most 60 seconds ahead'});
  });
 }).safeParse(body);
}
export const filterSchema=z.object({
 actor:z.string().trim().max(128).optional(),
 eventType:z.enum(eventTypes).optional(),
 time:z.enum(['all','24h','7d']).default('all'),
});
export function parseEventFilters(input:Record<string,unknown>){
 const cleaned={...input};for(const key of ['actor','eventType','time'])if(cleaned[key]==='')cleaned[key]=undefined;
 return filterSchema.safeParse(cleaned);
}
export function parseFilters(params:URLSearchParams){
 const input:Record<string,unknown>={};
 for(const key of ['actor','eventType','time']){const values=params.getAll(key);if(values.length)input[key]=values.length===1?values[0]:values;}
 return parseEventFilters(input);
}
