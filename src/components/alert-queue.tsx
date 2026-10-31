import Link from 'next/link';
import type { ReactNode } from 'react';
import { IncidentStatus } from './incident-status';
import { IncidentFilters } from './incident-filters';
import { FilterSheet } from './dashboard/filter-sheet';
import { Meter } from './dashboard/meter';
import { actorOf,ago,signalOf,sourceOf,statusLabel,toneFor } from './dashboard/view';
import { INCIDENT_PAGE_SIZE,type AlertFilters } from '@/lib/investigation';
import { Icon } from './icon';
export type AlertView={id:string;title:string;rule_id:string;severity:string;status:string;created_at:string;priority_score:number|null;priority_band:string|null;score_factors:{key:string;label:string;points:number;explanation:string}[]|null;evidence:{detector?:string;actor?:string;failureCount?:number;windowSeconds?:number;threshold?:number;demo?:boolean;explanation?:string;[key:string]:unknown}};
export function AlertQueue({alerts,canUpdate,filters,matchingCount,toolbar}:{alerts:AlertView[];canUpdate:boolean;filters:AlertFilters;matchingCount:number;toolbar?:ReactNode}){
 const page=filters.page??1;const pages=Math.max(1,Math.ceil(matchingCount/INCIDENT_PAGE_SIZE));
 const pageHref=(page:number)=>{const params=new URLSearchParams();for(const [k,v] of Object.entries(filters))if(v!==undefined&&v!==''&&!(k==='page'&&page===1))params.set(k,String(k==='page'?page:v));if(page>1)params.set('page',String(page));return `/dashboard?${params.toString()}#queue`;};
 const activeFilters=[filters.actor,filters.status,filters.severity,filters.priority,filters.sort==='priority'?'priority':'',filters.time&&filters.time!=='all'?filters.time:''].filter(Boolean).length;
 const searching=activeFilters>0||Boolean(filters.q)||Boolean(filters.escalation);
 const now=Date.now();
 return <section className="dx-queue" id="queue" aria-labelledby="queue-title" data-reveal>
 <div className="dx-queue__head"><div><h2 id="queue-title">Incident queue</h2><p>{matchingCount===0?'No incidents match.':`${matchingCount} incident${matchingCount===1?'':'s'}${filters.q?` matching “${filters.q}”`:''}`}</p></div><FilterSheet activeCount={activeFilters}><IncidentFilters filters={filters} variant="sheet"/></FilterSheet></div>
 {toolbar}
 {!alerts.length?<div className="dx-empty dx-empty--inline"><span className="dx-tile" aria-hidden="true"><Icon name="shield" size={26}/></span><h3>{searching?'No matching incidents':'No incidents yet'}</h3><p>{searching?'Try a different search or clear the filters.':'Send simulated events and detections will appear here.'}</p>{searching&&<Link className="sx-btn sx-btn--ghost sx-btn--sm" href="/dashboard#queue">Clear search and filters</Link>}</div>:<ul className="dx-list">{alerts.map(alert=>{const tone=toneFor(alert.priority_band,alert.severity);const actor=actorOf(alert.evidence);const when=ago(alert.created_at,now);return <li key={alert.id}><details className="dx-row">
 <summary><span className={`dx-dot tone-${tone}`} aria-hidden="true"/><span className="dx-row__main"><span className="dx-row__title">{alert.title}</span><span className="dx-row__sub">{actor??'No actor recorded'}<span className="dx-row__ago"> · {when}</span></span></span><span className="dx-row__band">{alert.priority_band?statusLabel(alert.priority_band):'Unscored'}<Meter score={alert.priority_score} band={alert.priority_band} tone={tone}/></span><time className="dx-row__time" dateTime={alert.created_at} title={`${alert.created_at.slice(0,19).replace('T',' ')} UTC`}>{when}</time><span className={`dx-status s-${alert.status.toLowerCase()}`}><i/>{statusLabel(alert.status)}</span><Icon name="chevronRight" size={16}/></summary>
 <div className="dx-row__body"><p>{alert.evidence.explanation??'A sample incident for testing your investigation workflow.'}</p><p className="dx-row__facts"><span>{signalOf(alert.evidence)}</span>{sourceOf(alert.evidence)&&<span>{sourceOf(alert.evidence)}</span>}{typeof alert.evidence.failureCount==='number'&&<span>{alert.evidence.failureCount} failures</span>}{typeof alert.evidence.windowSeconds==='number'&&<span>{alert.evidence.windowSeconds}s window</span>}<span>{alert.created_at.slice(0,19).replace('T',' ')} UTC</span></p>
 <details className="dx-more"><summary>Why this score?</summary>{alert.score_factors?.length?<ul className="score-breakdown">{alert.score_factors.map(f=><li key={f.key}><strong>+{f.points} · {f.label}</strong><span>{f.explanation}</span></li>)}</ul>:<p>Insufficient immutable evidence to calculate a score.</p>}<strong>Total: {alert.priority_score??'Unscored'}{alert.priority_score!==null?` / 100 · ${alert.priority_band}`:''}</strong></details>
 <details className="dx-more"><summary>Evidence snapshot</summary><pre>{JSON.stringify(alert.evidence,null,2)}</pre></details>
 <div className="dx-row__actions"><Link className="sx-btn sx-btn--primary sx-btn--sm" href={`/incidents/${alert.id}`}>Investigate incident <span className="sx-btn__arrow"><Icon name="arrow" size={16}/></span></Link>{canUpdate&&<IncidentStatus id={alert.id} status={alert.status} title={alert.title}/>}</div></div>
 </details></li>;})}</ul>}
 <nav className="dx-pager-row" aria-label="Incident pages"><span>Page {page} of {pages} · priority score is separate from status</span><span>{page>1&&<Link className="sx-btn sx-btn--ghost sx-btn--sm" href={pageHref(page-1)}><span className="sx-btn__arrow sx-btn__arrow--back"><Icon name="arrowLeft" size={16}/></span>Previous</Link>}{page<pages&&<Link className="sx-btn sx-btn--ghost sx-btn--sm" href={pageHref(page+1)}>Next <span className="sx-btn__arrow"><Icon name="arrow" size={16}/></span></Link>}</span></nav></section>;
}
