import { currentUser } from '@/lib/auth';
import { canReadIncidentTimeline } from '@/lib/timeline-access';
import { db } from '@/lib/db';
import { evidenceIds,parseRelatedTimelineFilters,relatedTimelineSql,relatedTimelineValues,RELATED_TIMELINE_PAGE_SIZE,uuidSchema } from '@/lib/investigation';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await currentUser();if(!user)return json({error:'Unauthenticated'},401);
  if(!canReadIncidentTimeline(user.role))return json({error:'Forbidden'},403);
  const {id}=await params;if(!uuidSchema.safeParse(id).success)return json({error:'Invalid incident'},400);
  const filters=parseRelatedTimelineFilters(new URL(request.url).searchParams);if(!filters.success)return json({error:'Invalid timeline filters'},400);
  const {rows:[alert]}=await db.query<{evidence:Record<string,unknown>}>('SELECT evidence FROM alerts WHERE id=$1',[id]);
  if(!alert)return json({error:'Incident not found'},404);
  const ids=evidenceIds(alert.evidence).ids;
  const {rows}=await db.query(relatedTimelineSql,relatedTimelineValues(ids,filters.data));
  const hasMore=rows.length>RELATED_TIMELINE_PAGE_SIZE;const events=rows.slice(0,RELATED_TIMELINE_PAGE_SIZE);const last=events.at(-1);
  return json({events,page:filters.data.page,hasMore,nextCursor:hasMore&&last?{afterOccurredAt:new Date(last.occurred_at).toISOString(),afterId:last.id}:null});
 }catch(error){console.error('incident.timeline failed',error);return json({error:'Unable to load related events'},503);}
}
