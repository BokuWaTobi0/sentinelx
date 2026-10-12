import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { uuidSchema,relatedAlertsSql } from '@/lib/investigation';
import type { EventRow } from '@/lib/event-sql';
import { Header } from '@/components/header';
export default async function EventDetail({params}:{params:Promise<{id:string}>}){
 const user=await requirePermission('events:read');await requirePermission('alerts:read');const {id}=await params;if(!uuidSchema.safeParse(id).success)notFound();
 const {rows:[event]}=await db.query<EventRow>('SELECT id,occurred_at,source,event_type,actor,host(source_ip) AS source_ip,payload,ingested_at FROM events WHERE id=$1',[id]);if(!event)notFound();
 const {rows:alerts}=await db.query<{id:string;title:string;severity:string;status:string}>(relatedAlertsSql,[id,id]);
 return <><Header user={user}/><div className="app-content"><Link className="back-link" href="/events">← Event stream</Link><div className="page-heading"><div><p className="eyebrow">EVENT INSPECTION</p><h1>{event.event_type.replaceAll('_',' ').toLowerCase()}</h1><p className="page-description">One stored observation{event.payload.demo===true?' · simulated data':''}.</p></div></div><section className="panel"><div className="panel-heading"><h2>Event record</h2><span className="badge neutral">{event.event_type}</span></div><div className="investigation-summary"><dl className="detail-grid"><div><dt>Actor</dt><dd>{event.actor}</dd></div><div><dt>Source IP</dt><dd>{event.source_ip}</dd></div><div><dt>Source</dt><dd>{event.source}</dd></div><div><dt>Occurred at (UTC)</dt><dd>{new Date(event.occurred_at).toISOString()}</dd></div><div><dt>Ingested at (UTC)</dt><dd>{new Date(event.ingested_at).toISOString()}</dd></div><div><dt>Event ID</dt><dd className="mono">{id}</dd></div></dl><h3 className="payload-heading">Stored payload</h3><pre>{JSON.stringify(event.payload,null,2)}</pre></div></section><section className="panel"><div className="panel-heading"><div><h2>Linked incidents</h2><p>Latest 20 incidents referencing this exact event.</p></div></div>{!alerts.length?<div className="empty-state"><p>No incident references this event.</p></div>:<div className="linked-incidents">{alerts.map(alert=><Link key={alert.id} href={`/incidents/${alert.id}`}><strong>{alert.title}</strong><span className={`badge ${alert.severity.toLowerCase()}`}>{alert.severity}</span><small>{alert.status.replace('_',' ')}</small></Link>)}</div>}</section></div></>;
}
