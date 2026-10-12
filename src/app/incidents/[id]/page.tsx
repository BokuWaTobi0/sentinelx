import Link from 'next/link';
import { IncidentAutomation } from '@/components/incident-automation';
import { IncidentResponse } from '@/components/incident-response';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { evidenceIds,evidenceEventsSql,uuidSchema } from '@/lib/investigation';
import type { AlertView } from '@/components/alert-queue';
import type { EventRow } from '@/lib/event-sql';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { IncidentStatus } from '@/components/incident-status';
import { RefreshButton } from '@/components/refresh-button';
type Alert=Omit<AlertView,'created_at'>&{created_at:Date;updated_at:Date;event_id:string|null};
export default async function Incident({params}:{params:Promise<{id:string}>}){
 const user=await requirePermission('alerts:read');await requirePermission('events:read');
 const {id}=await params;if(!uuidSchema.safeParse(id).success)notFound();
 const {rows:[alert]}=await db.query<Alert>('SELECT id,title,rule_id,severity,status,evidence,created_at,updated_at,event_id FROM alerts WHERE id=$1',[id]);
 if(!alert)notFound();
 const snapshot=evidenceIds(alert.evidence);
 const {rows:events}=await db.query<EventRow>(evidenceEventsSql,[snapshot.ids]);
 const missing=snapshot.ids.filter(id=>!events.some(event=>event.id===id));
 const audit=can(user.role,'audit:read')?(await db.query(`SELECT a.id,a.action,a.metadata,a.created_at,u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.target_id=$1 ORDER BY a.created_at ASC,a.id ASC LIMIT 50`,[id])).rows:null;
 return <><Header user={user}/><div className="app-content"><Link className="back-link" href="/dashboard">← Incident queue</Link><div className="page-heading"><div><p className="eyebrow">INCIDENT INVESTIGATION</p><h1>{alert.title}</h1><p className="page-description">{alert.evidence.detector?'Rule-generated alert':'Seeded demonstration alert'}{alert.evidence.demo===true?' · simulated input':''}</p></div><RefreshButton/></div>
 <section className="panel"><div className="panel-heading"><div className="incident-meta"><span className={`badge ${alert.severity.toLowerCase()}`}>{alert.severity}</span><span className={`status ${alert.status.toLowerCase()}`}><i/>{alert.status.replace('_',' ')}</span><span className="subtle-label">{alert.rule_id}</span></div>{can(user.role,'alerts:update')&&<IncidentStatus id={id} status={alert.status} title={alert.title}/>}</div><div className="investigation-summary"><p>{alert.evidence.explanation??'This sample alert has no linked event snapshot. Generate a burst to investigate a detected incident.'}</p><dl className="detail-grid"><div><dt>Actor</dt><dd>{alert.evidence.actor??'Not recorded'}</dd></div><div><dt>Recorded failure count</dt><dd>{alert.evidence.failureCount??'Not recorded'}</dd></div><div><dt>Window</dt><dd>{alert.evidence.windowSeconds??'Not recorded'} seconds</dd></div><div><dt>Created (UTC)</dt><dd>{new Date(alert.created_at).toISOString()}</dd></div><div><dt>Last updated (UTC)</dt><dd>{new Date(alert.updated_at).toISOString()}</dd></div><div><dt>Incident ID</dt><dd className="mono">{id}</dd></div></dl></div></section>
 <section className="panel"><div className="panel-heading"><div><h2>Evidence timeline <span className="count-pill">{events.length}</span></h2><p>Only events referenced by this snapshot · earliest first · UTC event time</p></div><Icon name="clock"/></div>
 {(missing.length>0||snapshot.invalid>0||snapshot.omitted>0||alert.evidence.evidenceTruncated===true)&&<div className="evidence-warning">This snapshot is incomplete: {missing.length} referenced events unavailable, {snapshot.invalid} invalid references, {snapshot.omitted} references beyond the display cap.{alert.evidence.evidenceTruncated===true?' The detector originally capped evidence at 100 event IDs.':''}</div>}
 {!events.length?<div className="empty-state"><Icon name="pulse" size={30}/><h3>No linked evidence events</h3><p>{snapshot.ids.length?'The referenced events are no longer available.':'This alert has no event-ID snapshot. The seeded demo is not reconstructed from unrelated actor activity.'}</p><Link className="button secondary" href="/events">Browse event stream</Link></div>:<ol className="evidence-timeline">{events.map((event,index)=><li key={event.id}><span className="timeline-number">{String(index+1).padStart(2,'0')}</span><div className="timeline-content"><div className="timeline-top"><span className={event.event_type==='LOGIN_FAILURE'?'badge high':'badge success'}>{event.event_type}</span><time>{new Date(event.occurred_at).toISOString()}</time></div><h3>{event.actor}</h3><p>{event.source_ip} · {event.source}</p><small>{typeof event.payload.reason==='string'?event.payload.reason:'No reason recorded'}</small><Link className="investigate-link" href={`/events/${event.id}`}>Open exact event <Icon name="arrow" size={14}/></Link><details className="evidence"><summary>Event payload</summary><pre>{JSON.stringify(event.payload,null,2)}</pre></details></div></li>)}</ol>}
 <div className="panel-footer">Showing {events.length} available events out of {snapshot.ids.length} valid snapshot references <span>Event time and ingestion time are different timestamps.</span></div></section>
 <section className="panel"><div className="panel-heading"><div><h2>Detection snapshot</h2><p>Frozen evidence from the moment the rule triggered.</p></div></div><div className="snapshot-body"><pre>{JSON.stringify(alert.evidence,null,2)}</pre>{alert.evidence.actor&&<Link className="investigate-link" href={`/events?actor=${encodeURIComponent(alert.evidence.actor)}`}>Browse wider actor activity <Icon name="arrow" size={14}/></Link>}</div></section>
 <IncidentAutomation id={id} user={user}/>
 <IncidentResponse id={id} user={user} status={alert.status} actor={alert.evidence.actor}/>
 {audit!==null&&<section className="panel"><div className="panel-heading"><div><h2>Incident audit history</h2><p>Admin-only · earliest 50 recorded actions</p></div></div>{!audit.length?<div className="empty-state"><p>No incident-specific audit records.</p></div>:<div className="audit-list">{audit.map(entry=><article className="audit-entry" key={entry.id}><span className="audit-icon"><Icon name="check" size={16}/></span><div><strong>{entry.action}</strong><p>{entry.email??'System / detector'}</p><details className="evidence"><summary>Action metadata</summary><pre>{JSON.stringify(entry.metadata,null,2)}</pre></details></div><time>{new Date(entry.created_at).toISOString()}</time></article>)}</div>}</section>}
 <footer className="workspace-footer"><span>SentinelX / Investigation</span><span>Evidence first · decisions remain yours</span></footer></div></>;
}
