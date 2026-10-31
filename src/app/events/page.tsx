import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { eventSearchSql,timeSeconds } from '@/lib/investigation';
import { Icon } from '@/components/icon';
import { Header } from '@/components/header';
import { EventRefresh } from '@/components/event-refresh';
import { eventTypes, parseEventFilters } from '@/lib/event-schema';
import { eventStatsSql, type EventRow } from '@/lib/event-sql';
import '@/styles/public.css';
import '@/styles/workspace.css';
export default async function Events({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const user=await requirePermission('events:read');
 const params=await searchParams;
 const filters=parseEventFilters(params);
 if(!filters.success) return <><Header user={user}/><div className="app-content dx-page sx-scope"><section className="dx-empty"><span className="dx-tile" aria-hidden="true"><Icon name="alert" size={26}/></span><h1>Invalid filters</h1><p>One of the filters in the address could not be read.</p><Link className="sx-btn sx-btn--primary" href="/events">Clear filters</Link></section></div></>;
 const [{rows:events},{rows:[stats]}]=await Promise.all([
  db.query<EventRow>(eventSearchSql,[filters.data.actor??null,filters.data.eventType??null,timeSeconds(filters.data.time)]),
  db.query<{total:number;failures:number;actors:number}>(eventStatsSql),
 ]);
 return <><Header user={user}/><div className="app-content dx-page sx-scope wx-page">
 <header className="wx-head"><div><p className="dx-eyebrow">Telemetry</p><h1 className="wx-h1">Event stream</h1><p className="wx-sub">Latest 100 matching events · refreshes every 5 seconds · times in UTC</p></div><EventRefresh/></header>
 <div className="wx-stats"><div><strong>{stats.total}</strong><span>Events · 24h</span></div><div><strong>{stats.failures}</strong><span>Failed logins · 24h</span></div><div><strong>{stats.actors}</strong><span>Distinct actors · 24h</span></div></div>
 <section className="wx-surface" aria-label="Activity log">
 <form method="get" className="wx-filters"><label>Exact actor<input name="actor" maxLength={128} defaultValue={filters.data.actor??''} placeholder="demo-target"/></label><label>Event type<select name="eventType" defaultValue={filters.data.eventType??''}><option value="">All types</option>{eventTypes.map(type=><option key={type}>{type}</option>)}</select></label><label>Occurred within<select name="time" defaultValue={filters.data.time}><option value="all">All time</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label><button className="sx-btn sx-btn--primary sx-btn--sm">Apply</button><Link className="wx-link" href="/events">Clear</Link></form>
 {!events.length?<div className="wx-empty"><Icon name="pulse" size={28}/><h3>No matching events</h3><p>Clear your filters or send a batch from the simulator.</p></div>:<div className="table-scroll"><table className="wx-table"><thead><tr><th>Time / source</th><th>Type</th><th>Actor / IP</th><th>Details</th></tr></thead><tbody>{events.map(event=><tr key={event.id}><td><time>{new Date(event.occurred_at).toISOString().slice(0,19).replace('T',' ')}</time><small>{event.source}</small></td><td><span className={event.event_type==='LOGIN_FAILURE'?'wx-tag wx-tag--warn':'wx-tag'}>{event.event_type}</span>{event.payload.demo===true&&<small>Simulated</small>}</td><td>{event.actor}<small>{event.source_ip}</small></td><td><Link className="wx-open" href={`/events/${event.id}`}>Inspect →</Link><details className="wx-details"><summary>Payload</summary><pre>{JSON.stringify(event.payload,null,2)}</pre><small>Event ID: {event.id}</small></details></td></tr>)}</tbody></table></div>}
 <p className="wx-note">Synthetic logs are marked Simulated. Deterministic rules flag suspicious patterns; they do not confirm attacks. Actor labels are not verified account identities.</p>
 </section></div></>;
}
