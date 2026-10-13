import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventSearchSql,timeSeconds } from '@/lib/investigation';
import { Icon } from '@/components/icon';
import { Header } from '@/components/header';
import { EventRefresh } from '@/components/event-refresh';
import { eventTypes, parseEventFilters } from '@/lib/event-schema';
import { eventStatsSql, type EventRow } from '@/lib/event-sql';
export default async function Events({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const user=await requirePermission('events:read');
 const params=await searchParams;
 const filters=parseEventFilters(params);
 if(!filters.success) return <><Header user={user}/><div className="app-content"><section className="panel empty-state"><h2>Invalid filters</h2><Link href="/events">Clear filters</Link></section></div></>;
 const [{rows:events},{rows:[stats]}]=await Promise.all([
  db.query<EventRow>(eventSearchSql,[filters.data.actor??null,filters.data.eventType??null,timeSeconds(filters.data.time)]),
  db.query<{total:number;failures:number;actors:number}>(eventStatsSql),
 ]);
 return <><Header user={user}/><div className="app-content"><div className="page-heading"><div><p className="eyebrow">TELEMETRY EXPLORER</p><h1>Event stream<span className="accent">.</span></h1><p className="page-description">Latest 100 matching events · auto-refresh every 5 seconds · times in UTC</p></div><EventRefresh/></div>
 <div className="metric-grid three"><div className="metric"><strong>{stats.total}</strong><small>All events · last 24 hours</small></div><div className="metric"><strong>{stats.failures}</strong><small>Failed logins · last 24 hours</small></div><div className="metric"><strong>{stats.actors}</strong><small>Distinct actors · last 24 hours</small></div></div>
 <section className="panel"><div className="panel-heading"><div><h2>Activity log</h2><p>Find the events behind a signal.</p></div><span className="subtle-label">UTC TIMESTAMPS</span></div><form method="get" className="event-filters"><label>Exact actor<input name="actor" maxLength={128} defaultValue={filters.data.actor??''} placeholder="demo-target"/></label><label>Event type<select name="eventType" defaultValue={filters.data.eventType??''}><option value="">All types</option>{eventTypes.map(type=><option key={type}>{type}</option>)}</select></label><label>Occurred within<select aria-label="Occurred within" name="time" defaultValue={filters.data.time}><option value="all">All time</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label><button className="button">Apply filters</button><Link href="/events">Clear</Link></form>
 <p className="telemetry-note">Synthetic logs are marked SIMULATED. Deterministic rules flag suspicious patterns; they do not confirm attacks. Actor labels are not verified account identities.</p>
 {!events.length?<div className="empty-state"><Icon name="pulse" size={32}/><h3>No matching events</h3><p>Clear your filters or send a batch from the simulator.</p></div>:<div className="table-scroll"><table><thead><tr><th>Time / source</th><th>Type</th><th>Actor / IP</th><th>Details</th></tr></thead><tbody>{events.map(event=><tr key={event.id}><td><time>{new Date(event.occurred_at).toISOString()}</time><br/><small>{event.source}</small></td><td><span className={event.event_type==='LOGIN_FAILURE'?'badge high':'badge success'}>{event.event_type}</span>{event.payload.demo===true&&<p><small>SIMULATED</small></p>}</td><td>{event.actor}<br/><small>{event.source_ip}</small></td><td><Link className="investigate-link" href={`/events/${event.id}`}>Inspect event →</Link><details><summary>Payload</summary><pre>{JSON.stringify(event.payload,null,2)}</pre><small>Event ID: {event.id}</small></details></td></tr>)}</tbody></table></div>}
 </section><footer className="workspace-footer"><span>SentinelX / Telemetry</span><span>Auto-refresh · 5-second interval</span></footer></div></>;
}

