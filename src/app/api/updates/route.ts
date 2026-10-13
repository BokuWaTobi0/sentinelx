import { currentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { uuidSchema } from '@/lib/investigation';
export async function GET(request:Request){
 try{
  const user=await currentUser();if(!user)return Response.json({error:'Session expired. Sign in again.'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(!can(user.role,'alerts:read'))return Response.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});
  const url=new URL(request.url),incident=url.searchParams.get('incidentId'),since=url.searchParams.get('since');
  if(incident&&!uuidSchema.safeParse(incident).success)return Response.json({error:'Invalid incident identifier.'},{status:400});
  if(incident&&!can(user.role,'events:read'))return Response.json({error:'Forbidden'},{status:403});
  const {rows:[revision]}=incident?await db.query<{revision:string}>(`SELECT concat((SELECT greatest((SELECT max(updated_at) FROM alerts WHERE id=$1),(SELECT max(created_at) FROM incident_history WHERE incident_id=$1))::text),'|',(SELECT coalesce(string_agg(id::text||':'||status||':'||attempts||':'||coalesce(finished_at::text,''),',' ORDER BY created_at DESC,id DESC),'') FROM (SELECT id,status,attempts,finished_at,created_at FROM automation_jobs WHERE incident_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50) jobs)) AS revision`,[incident]):await db.query<{revision:string}>(`SELECT concat((SELECT greatest((SELECT max(updated_at) FROM alerts),(SELECT max(created_at) FROM incident_history),(SELECT max(ingested_at) FROM events))::text),'|',(SELECT coalesce(string_agg(id::text||':'||status||':'||attempts||':'||coalesce(finished_at::text,''),',' ORDER BY created_at DESC,id DESC),'') FROM (SELECT id,status,attempts,finished_at,created_at FROM automation_jobs ORDER BY created_at DESC,id DESC LIMIT 200) jobs)) AS revision`);
  const newIncidents=!incident&&since?((await db.query('SELECT 1 FROM alerts WHERE created_at>$1::timestamptz LIMIT 1',[since])).rowCount??0)>0:false;
  const notificationSince=url.searchParams.get('notificationSince');
  const [{rows:[unread]},{rows:newNotifications}]=await Promise.all([
   db.query<{count:number}>('SELECT count(*)::int AS count FROM notifications WHERE recipient_id=$1 AND read_at IS NULL',[user.id]),
   notificationSince?db.query<{id:string;kind:string;title:string;message:string;incident_id:string;created_at:Date}>('SELECT id,kind,title,message,incident_id,created_at FROM notifications WHERE recipient_id=$1 AND created_at>$2::timestamptz ORDER BY created_at DESC,id DESC LIMIT 5',[user.id,notificationSince]):Promise.resolve({rows:[] as {id:string;kind:string;title:string;message:string;incident_id:string;created_at:Date}[]}),
  ]);
  return Response.json({revision:revision.revision,newIncidents,unreadCount:unread.count,newNotifications,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('live updates failed',error);return Response.json({error:'Live update check failed.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
