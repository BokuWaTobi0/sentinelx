'use client';
import { useEffect,useState,type FormEvent } from 'react';
import { Icon } from './icon';

type RelatedEvent={id:string;occurred_at:string;event_type:string;actor:string|null;source_ip:string|null;source:string;payload:Record<string,unknown>};
export function RelatedEventTimeline({incidentId,evidenceEventIds,evidenceTruncated=false}:{incidentId:string;evidenceEventIds:string[];evidenceTruncated?:boolean}){
 const [actorInput,setActorInput]=useState(''),[sourceIpInput,setSourceIpInput]=useState(''),[timeInput,setTimeInput]=useState('all');
 const [actor,setActor]=useState(''),[sourceIp,setSourceIp]=useState(''),[time,setTime]=useState('all');
 const [events,setEvents]=useState<RelatedEvent[]>([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false);
 const [cursor,setCursor]=useState<{afterOccurredAt:string;afterId:string}|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  const query=new URLSearchParams({page:String(page),time});if(actor.trim())query.set('actor',actor.trim());if(sourceIp.trim())query.set('sourceIp',sourceIp.trim());if(cursor){query.set('afterOccurredAt',cursor.afterOccurredAt);query.set('afterId',cursor.afterId);}
  fetch(`/api/incidents/${incidentId}/timeline?${query}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
   const data=await response.json();if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Unable to load related events');
   const next=data.events as RelatedEvent[];
   setEvents(current=>page===1?next:[...current,...next]);setHasMore(Boolean(data.hasMore));setCursor(data.nextCursor??null);
  }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to load related events');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[incidentId,actor,sourceIp,time,page,refresh]);
 function applyFilters(event:FormEvent<HTMLFormElement>){event.preventDefault();setActor(actorInput.trim());setSourceIp(sourceIpInput.trim());setTime(timeInput);setCursor(null);setEvents([]);setPage(1);setHasMore(false);setRefresh(value=>value+1);}
 return <section className="panel related-timeline" aria-labelledby="related-events-heading">
  <div className="panel-heading"><div><h2 id="related-events-heading">Related event timeline <span className="count-pill">LATER CONTEXT</span></h2><p>Events fetched from the current event store; these are not part of the immutable trigger snapshot.</p></div><Icon name="clock"/></div>
  <form className="related-timeline-filters" onSubmit={applyFilters}>
   <label>Actor label<input value={actorInput} maxLength={128} onChange={event=>setActorInput(event.target.value)} placeholder="Any actor"/></label>
   <label>Source IP<input value={sourceIpInput} maxLength={45} onChange={event=>setSourceIpInput(event.target.value)} placeholder="Any source IP"/></label>
   <label>Time range<select value={timeInput} onChange={event=>setTimeInput(event.target.value)}><option value="all">All available</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label>
   <button className="button secondary" type="submit">Apply filters</button>
  </form>
  <p className="telemetry-note">The query excludes IDs recorded in immutable triggering evidence. This list is later context and may change as events arrive. Ordered by event time, then event ID.{evidenceTruncated?' Some trigger IDs were capped, so unrecorded trigger events can also appear here.':''}</p>
  {error&&<div className="timeline-state error" role="alert"><p>{error}</p><button className="button secondary" type="button" onClick={()=>setRefresh(value=>value+1)}>Retry</button></div>}
  {!error&&loading&&events.length===0&&<div className="timeline-state" role="status"><span className="spinner"/>Loading related events…</div>}
  {!error&&!loading&&events.length===0&&<div className="timeline-state"><h3>No related events found</h3><p>Try a broader time range or clear the actor and source IP filters.</p></div>}
  {events.length>0&&<ol className="related-event-list">{events.map((event,index)=><li key={`${event.id}-${index}`}><time dateTime={new Date(event.occurred_at).toISOString()}>{new Date(event.occurred_at).toISOString()}</time><span className={`badge ${event.event_type==='LOGIN_FAILURE'?'high':event.event_type==='LOGIN_SUCCESS'?'success':'neutral'}`}>{event.event_type}</span><span className="related-outcome">{event.event_type==='LOGIN_FAILURE'?'FAILURE':event.event_type==='LOGIN_SUCCESS'?'SUCCESS':'CHANGE'}</span><span className="related-actor">{event.actor??'No actor recorded'}</span><span className="related-ip">{event.source_ip??'No source IP'}</span></li>)}</ol>}
  {loading&&events.length>0&&<p className="timeline-loading-more" role="status">Loading more events…</p>}
  {hasMore&&!loading&&<div className="timeline-more"><button className="button secondary" type="button" onClick={()=>setPage(value=>value+1)} disabled={page>=200}>Load more events</button>{page>=200&&<small>Maximum 10,000 related events per filter set.</small>}</div>}
  <div className="panel-footer">{events.length} related event{events.length===1?'':'s'} loaded · maximum 50 per page <span>Trigger evidence is excluded from this list.</span></div>
 </section>;
}
