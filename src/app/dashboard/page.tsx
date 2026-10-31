import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { Header } from '@/components/header';
import { AlertQueue,type AlertView } from '@/components/alert-queue';
import { RefreshButton } from '@/components/refresh-button';
import { IncidentStatus } from '@/components/incident-status';
import { parseAlertFilters,alertSearchSql,alertFilterValues } from '@/lib/investigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { LiveUpdates } from '@/components/live-updates';
import { Greeting } from '@/components/dashboard/greeting';
import { FocusDeck } from '@/components/dashboard/focus-deck';
import { Dock } from '@/components/dashboard/dock';
import { toFocusIncident } from '@/components/dashboard/view';
import { ScrollReveal } from '@/components/site/scroll-reveal';
import '@/styles/public.css';
import '@/styles/dashboard.css';
 type AlertRow=Omit<AlertView,'created_at'>&{created_at:Date;total_matches:number};
 type FocusRow=Omit<AlertView,'created_at'>&{created_at:Date};
 const FOCUS_LIMIT=5;
 // "Needs review": still open, or unresolved at high / critical priority.
 const reviewWhere=`status<>'RESOLVED' AND (status='OPEN' OR priority_band IN ('HIGH','CRITICAL'))`;
export default async function Dashboard({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const user=await requirePermission('alerts:read');
 const dashboardLoadedAt=new Date().toISOString();
 const filters=parseAlertFilters(await searchParams);
 if(!filters.success)return <><Header user={user}/><div className="app-content dx-page sx-scope"><section className="dx-empty"><span className="dx-tile" aria-hidden="true"><Icon name="alert" size={26}/></span><h1>Invalid incident filters</h1><p>One of the filters in the address could not be read.</p><Link className="sx-btn sx-btn--primary" href="/dashboard">Clear filters</Link></section></div></>;
 const [{rows},{rows:[stats]},{rows:focusRows}]=await Promise.all([
 db.query<AlertRow>(alertSearchSql,alertFilterValues(filters.data)),
 db.query<{open:number;review:number;resolved:number;events:number}>(`SELECT
 (SELECT count(*)::int FROM alerts WHERE status='OPEN') AS open,
 (SELECT count(*)::int FROM alerts WHERE ${reviewWhere}) AS review,
 (SELECT count(*)::int FROM alerts WHERE status='RESOLVED') AS resolved,
 (SELECT count(*)::int FROM events WHERE occurred_at>=now()-interval '24 hours') AS events`),
 db.query<FocusRow>(`SELECT id,title,rule_id,severity,status,evidence,created_at,priority_score,priority_band,score_factors FROM alerts WHERE ${reviewWhere} ORDER BY priority_score DESC NULLS LAST,created_at DESC,id DESC LIMIT ${FOCUS_LIMIT}`),
 ]);
 const canUpdate=can(user.role,'alerts:update');
 const now=Date.now();
 const focus=focusRows.map(row=>toFocusIncident({...row,created_at:new Date(row.created_at).toISOString()},now));
 const controls=focusRows.map(row=>canUpdate?<IncidentStatus key={row.id} id={row.id} status={row.status} title={row.title}/>:null);
 const review=stats.review;
 const { q,page:_page,...rest }=filters.data;void _page;
 const carry=Object.fromEntries(Object.entries(rest).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>[k,String(v)]));
 return <><Header user={user}/><div className="app-content dx-page sx-scope"><div className="dx-glow" aria-hidden="true"/><ScrollReveal/>
 <div className="dx-first"><div className="dx-livebar"><LiveUpdates baseline={dashboardLoadedAt}/><RefreshButton/></div>
 <header className="dx-hero"><Greeting/><h1 className="dx-h1">{review>0?<><span className="sx-accent">{review} incident{review===1?'':'s'}</span> {review===1?'needs':'need'} review</>:<><span className="sx-accent">All clear</span> for now</>}</h1><p className="dx-sub">Investigate high-priority activity and take action to keep your environment secure.</p></header>
 {focus.length?<FocusDeck incidents={focus} controls={controls} role={user.role} total={review}/>:<section className="dx-empty" aria-labelledby="dx-empty-title"><span className="dx-tile dx-tile--lime" aria-hidden="true"><Icon name="check" size={26}/></span><h2 id="dx-empty-title">Nothing needs your attention.</h2><p>New incidents appear here the moment a detection rule opens one.</p></section>}
 <Dock query={q??''} carry={carry}/></div>
 <AlertQueue filters={filters.data} matchingCount={rows[0]?.total_matches??0} alerts={rows.map(row=>({...row,created_at:new Date(row.created_at).toISOString()}))} canUpdate={canUpdate} toolbar={user.role==='ANALYST'?<nav className="dx-chips" aria-label="Escalation queue filters"><span>Escalation review</span><Link href="/dashboard?escalation=PENDING#queue" aria-current={filters.data.escalation==='PENDING'?'true':undefined}>Awaiting acknowledgement</Link><Link href="/dashboard?escalation=ACKNOWLEDGED#queue" aria-current={filters.data.escalation==='ACKNOWLEDGED'?'true':undefined}>Awaiting investigation</Link>{filters.data.escalation&&<Link href="/dashboard#queue">Clear</Link>}</nav>:undefined}/>
 <footer className="dx-footer" data-reveal><p className="dx-footer__stats">{stats.open} open · {stats.resolved} resolved · {stats.events} events in the last 24 hours</p><p>Detection rules: actor bursts, password spraying, repeated source-IP failures, success after a burst.{can(user.role,'rules:manage')&&<> <Link href="/admin/rules">Manage rules</Link></>}</p><p>SentinelX · Security operations · Local demo · data includes simulations</p></footer></div></>;
}
