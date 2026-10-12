import { currentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { parseBatch, parseFilters } from '@/lib/event-schema';
import { eventSearchSql,timeSeconds } from '@/lib/investigation';
import { ingestEvents } from '@/lib/ingest-events';
import { BodyTooLarge, readBoundedJson, validIngestToken } from '@/lib/ingest-http';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request) {
 try {
 const user=await currentUser();
 if(!user) return json({error:'Unauthenticated'},401);
 if(!can(user.role,'events:read')) return json({error:'Forbidden'},403);
 const filters=parseFilters(new URL(request.url).searchParams);
 if(!filters.success) return json({error:'Invalid filters'},400);
  const {rows}=await db.query(eventSearchSql,[filters.data.actor??null,filters.data.eventType??null,timeSeconds(filters.data.time)]);
  return json({events:rows,limit:100});
 } catch(error) {console.error('events.read failed',error);return json({error:'Unable to read events'},503);}
}
export async function POST(request:Request) {
 const key=process.env.INGEST_API_KEY;
 if(!key || !/^[a-f0-9]{64}$/.test(key)) return json({error:'Ingestion key is not configured'},503);
 if(!validIngestToken(request.headers.get('authorization'),key)) return json({error:'Invalid ingestion credentials'},401);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json') return json({error:'Expected application/json'},415);
 let body:unknown;
 try {body=await readBoundedJson(request);}
 catch(error){return json({error:error instanceof BodyTooLarge?'Body exceeds 64 KiB':'Invalid JSON'},error instanceof BodyTooLarge?413:400);}
 const parsed=parseBatch(body);
 if(!parsed.success) return json({error:'Invalid event batch',issues:parsed.error.issues.map(issue=>({path:issue.path,message:issue.message}))},400);
 // Event insert, detection, and audit succeed or roll back together.
 try {
  const client=await db.connect();
  try {
   const result=await ingestEvents(client,parsed.data.events);
   return json(result,result.accepted>0?201:200);
  }
  finally {client.release();}
 } catch(error) {console.error('events.ingest failed',error);return json({error:'Unable to store events; retry with the same IDs'},503);}
}
