import {currentUser} from '@/lib/auth';
import {can} from '@/lib/rbac';
import {db} from '@/lib/db';
import {uuidSchema} from '@/lib/investigation';
import {loadInvestigationReport} from '@/lib/investigation-report';
import {renderInvestigationPdf} from '@/lib/report-pdf';
type Context={params:Promise<{id:string}>};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request,{params}:Context){
 const user=await currentUser();if(!user)return json({error:'Session expired. Sign in again.'},401);
 if(!can(user.role,'alerts:read')||!can(user.role,'events:read'))return json({error:'Forbidden'},403);
 const {id}=await params;if(!uuidSchema.safeParse(id).success)return json({error:'Incident not found.'},404);
 const url=new URL(request.url);if(url.searchParams.getAll('format').length!==1)return json({error:'Choose exactly one format: pdf or json.'},400);
 const format=url.searchParams.get('format');if(format!=='pdf'&&format!=='json')return json({error:'Choose format=pdf or format=json.'},400);
 const client=await db.connect();
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  const report=await loadInvestigationReport(client,id,user.role);if(!report){await client.query('ROLLBACK');return json({error:'Incident not found.'},404);}
  const body=format==='json'?JSON.stringify(report,null,2):renderInvestigationPdf(report);
  await client.query("INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,'incident.report_generated',$2,$3)",[user.id,id,JSON.stringify({format,asOf:report.asOf,historyTruncated:report.history.truncated,responseTruncated:report.responses.truncated,automationTruncated:report.automation.truncated,restrictedAuditIncluded:user.role==='ADMIN'})]);
  await client.query('COMMIT');
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="sentinelx-incident-${id}.${format}"`};
  return format==='json'?new Response(body as string,{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}}):new Response(Buffer.from(body as Uint8Array) as unknown as BodyInit,{headers:{...headers,'Content-Type':'application/pdf'}});
 }catch(error){try{await client.query('ROLLBACK');}catch{}console.error('incident report generation failed',error);return json({error:'Unable to generate this incident report.'},503);}finally{client.release();}
}
