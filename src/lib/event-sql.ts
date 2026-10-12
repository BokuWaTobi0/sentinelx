import type { SecurityEvent } from './event-schema';
// Parameterized bulk insertion. Producer-supplied UUIDs make retries idempotent.
export const insertEventsSql=`INSERT INTO events(id,occurred_at,source,event_type,actor,source_ip,payload)
 SELECT id,occurred_at,source,event_type,actor,source_ip::inet,payload
 FROM jsonb_to_recordset($1::jsonb) AS e(id uuid,occurred_at timestamptz,source text,event_type text,actor text,source_ip text,payload jsonb)
 ON CONFLICT(id) DO NOTHING RETURNING id`;
export function eventRecords(events:SecurityEvent[]) {
 return JSON.stringify(events.map(event=>({id:event.id,occurred_at:event.occurredAt,source:event.source,event_type:event.eventType,actor:event.actor,source_ip:event.sourceIp,payload:event.payload})));
}
export const listEventsSql=`SELECT id,occurred_at,source,event_type,actor,host(source_ip) AS source_ip,payload,ingested_at FROM events
 WHERE ($1::text IS NULL OR actor=$1) AND ($2::text IS NULL OR event_type=$2)
 ORDER BY occurred_at DESC,id DESC LIMIT 100`;
export const eventStatsSql=`SELECT count(*)::int AS total,
 count(*) FILTER (WHERE event_type='LOGIN_FAILURE')::int AS failures,
 count(DISTINCT actor)::int AS actors FROM events WHERE occurred_at>=now()-interval '24 hours'`;
export type EventRow={id:string;occurred_at:Date;source:string;event_type:string;actor:string;source_ip:string;payload:Record<string,unknown>;ingested_at:Date};
