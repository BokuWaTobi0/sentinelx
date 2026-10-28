import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { Header } from '@/components/header';
import { AlertQueue,type AlertView } from '@/components/alert-queue';
import { RefreshButton } from '@/components/refresh-button';
import { parseAlertFilters,alertSearchSql,alertFilterValues } from '@/lib/investigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { LiveUpdates } from '@/components/live-updates';
 type AlertRow=Omit<AlertView,'created_at'>&{created_at:Date;total_matches:number};
export default async function Dashboard({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const user=await requirePermission('alerts:read');
 const dashboardLoadedAt=new Date().toISOString();
 const filters=parseAlertFilters(await searchParams);
 if(!filters.success)return <><Header user={user}/><div className="app-content"><section className="panel empty-state"><h2>Invalid incident filters</h2><Link href="/dashboard">Clear filters</Link></section></div></>;
 const [{rows},{rows:[stats]}]=await Promise.all([
 db.query<AlertRow>(alertSearchSql,alertFilterValues(filters.data)),
 db.query<{open:number;critical:number;resolved:number;events:number}>(`SELECT
 (SELECT count(*)::int FROM alerts WHERE status='OPEN') AS open,
 (SELECT count(*)::int FROM alerts WHERE priority_band IN ('HIGH','CRITICAL') AND status<>'RESOLVED') AS critical,
 (SELECT count(*)::int FROM alerts WHERE status='RESOLVED') AS resolved,
 (SELECT count(*)::int FROM events WHERE occurred_at>=now()-interval '24 hours') AS events`),
 ]);
 return <><Header user={user}/><div className="app-content"><div className="page-heading"><div><p className="eyebrow">SECURITY OVERVIEW</p><h1>A clearer view of every signal<span className="accent">.</span></h1><p className="page-description">Investigate suspicious activity. Make informed decisions.</p></div><RefreshButton/></div>
 <LiveUpdates baseline={dashboardLoadedAt}/><div className="metric-grid"><div className="metric"><div className="metric-label">Open incidents<Icon name="alert"/></div><strong>{stats.open}</strong><small>Awaiting acknowledgement</small></div><div className="metric"><div className="metric-label">Elevated priority<Icon name="pulse"/></div><strong className="text-amber">{stats.critical}</strong><small>High / critical · unresolved</small></div><div className="metric"><div className="metric-label">Events received<Icon name="activity"/></div><strong>{stats.events}</strong><small>Across the last 24 hours</small></div><div className="metric"><div className="metric-label">Resolved incidents<Icon name="check"/></div><strong className="text-lime">{stats.resolved}</strong><small>Total resolved</small></div></div>
 <div className="rule-strip"><span className="rule-icon"><Icon name="shield"/></span><div><strong>Multiple suspicious-pattern rules</strong><span>Actor bursts · password spraying · repeated source-IP failures · success after a burst</span></div><span className="badge neutral">RULE CONFIGURED</span></div>
 {user.role==='ANALYST'&&<nav className="escalation-queue-filters" aria-label="Escalation queue filters"><span>Escalation review:</span><Link href="/dashboard?escalation=PENDING">Awaiting acknowledgement</Link><Link href="/dashboard?escalation=ACKNOWLEDGED">Awaiting investigation</Link>{filters.data.escalation&&<Link href="/dashboard">Clear filter</Link>}</nav>}
 <AlertQueue filters={filters.data} matchingCount={rows[0]?.total_matches??0} alerts={rows.map(row=>({...row,created_at:new Date(row.created_at).toISOString()}))} canUpdate={can(user.role,'alerts:update')}/><footer className="workspace-footer"><span>SentinelX / Security operations</span><span>Local demo · data includes simulations</span></footer></div></>;
}

