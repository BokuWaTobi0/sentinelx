import Link from 'next/link';
import { IncidentStatus } from './incident-status';
import { IncidentFilters } from './incident-filters';
import type { AlertFilters } from '@/lib/investigation';
import { Icon } from './icon';
export type AlertView={id:string;title:string;rule_id:string;severity:string;status:string;created_at:string;evidence:{detector?:string;actor?:string;failureCount?:number;windowSeconds?:number;threshold?:number;demo?:boolean;explanation?:string;[key:string]:unknown}};
export function AlertQueue({alerts,canUpdate,filters,matchingCount}:{alerts:AlertView[];canUpdate:boolean;filters:AlertFilters;matchingCount:number}){
 const filtered=alerts;
 return <section className="panel incident-panel"><div className="panel-heading"><div><h2>Incident queue <span className="count-pill">{matchingCount}</span></h2><p>Review signals. Follow the evidence.</p></div><span className="subtle-label">LATEST 100 MATCHES</span></div>
 <IncidentFilters filters={filters}/>
 {!filtered.length?<div className="empty-state"><Icon name="shield" size={32}/><h3>{'No matching incidents'}</h3><p>{'Clear filters or send simulated events to create an incident.'}</p><Link className="button secondary" href="/dashboard">Clear filters</Link></div>:<div className="incident-list">{filtered.map(alert=><article className="incident" key={alert.id}>
 <div className={`incident-symbol ${alert.severity.toLowerCase()}`}><Icon name="alert" size={22}/></div><div className="incident-content"><div className="incident-meta"><span className={`badge ${alert.severity.toLowerCase()}`}>{alert.severity}</span><span className={`status ${alert.status.toLowerCase()}`}><i/>{alert.status.replace('_',' ')}</span><span className="source-label">{alert.evidence.detector?'RULE DETECTED':'SEEDED DEMO'}{alert.evidence.demo===true?' · SIMULATED':''}</span></div>
 <h3><Link href={`/incidents/${alert.id}`}>{alert.title}</Link></h3><p className="incident-description">{alert.evidence.explanation??'A sample incident for testing your investigation workflow.'}</p><div className="incident-facts"><span><Icon name="users" size={14}/>{alert.evidence.actor??'Demo actor'}</span>{typeof alert.evidence.failureCount==='number'&&<span><Icon name="activity" size={14}/>{alert.evidence.failureCount} failures</span>}{typeof alert.evidence.windowSeconds==='number'&&<span><Icon name="clock" size={14}/>{alert.evidence.windowSeconds}s window</span>}<time>{alert.created_at.slice(0,19).replace('T',' ')} UTC</time></div>
 <div className="incident-controls"><Link className="investigate-link" href={`/incidents/${alert.id}`}>Investigate incident <Icon name="arrow" size={16}/></Link><details className="evidence"><summary>Evidence snapshot</summary><pre>{JSON.stringify(alert.evidence,null,2)}</pre></details></div>
 </div>{canUpdate&&<IncidentStatus id={alert.id} status={alert.status} title={alert.title}/>}
 </article>)}</div>}<div className="panel-footer">Showing {alerts.length} of {matchingCount} database matches <span>Evidence snapshots retain the events that triggered each rule.</span></div></section>;
}
