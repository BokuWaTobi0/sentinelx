import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SqlClient } from './sql-client';
export type AutomationJob={id:string;incident_id:string;response_id:string|null;kind:'INVESTIGATE'|'CONTAIN_SIMULATED';status:'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED';provider:'LOCAL'|'WINDMILL'|null;payload:Record<string,unknown>;result:Record<string,unknown>|null;attempts:number;lease_token:string|null;error_code:string|null;created_at:Date;finished_at:Date|null};
const resultBase={jobId:z.string().uuid(),incidentId:z.string().uuid(),engine:z.enum(['LOCAL','WINDMILL']),realWorldChanges:z.literal(false),windmillRunId:z.string().uuid().optional()};
export const automationResult=z.discriminatedUnion('kind',[
 z.object({...resultBase,kind:z.literal('INVESTIGATE'),summary:z.string().min(1).max(2000),recommendation:z.string().min(1).max(2000),failureCount:z.number().int().nonnegative(),sourceIpCount:z.number().int().nonnegative()}),
 z.object({...resultBase,kind:z.literal('CONTAIN_SIMULATED'),responseId:z.string().uuid(),actor:z.string().min(1).max(500),action:z.literal('CONTAIN_ACTOR'),mode:z.literal('SIMULATION'),message:z.string().min(1).max(2000)})
]);
// Caller owns the surrounding detection/approval transaction.
export async function enqueueAutomation(client:SqlClient,incidentId:string,kind:AutomationJob['kind'],snapshot:Record<string,unknown>,responseId:string|null=null){
 const id=randomUUID();
 const payload={...snapshot,jobId:id,incidentId,kind,responseId};
 const {rows}=await client.query<{id:string}>(`INSERT INTO automation_jobs(id,incident_id,response_id,kind,payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,[id,incidentId,responseId,kind,JSON.stringify(payload)]);
 if(rows.length)await client.query("INSERT INTO audit_logs(action,target_id,metadata) VALUES ('automation.queued',$1,$2)",[incidentId,JSON.stringify({jobId:id,kind,responseId})]);
 return rows[0]?.id??null;
}
export async function claimAutomation(client:SqlClient,provider?:'LOCAL'|'WINDMILL'):Promise<AutomationJob|null>{
 await client.query('BEGIN');
 try{
  const expired=await client.query<AutomationJob>(`UPDATE automation_jobs SET status='FAILED',error_code='LEASE_EXHAUSTED',lease_token=NULL,lease_expires_at=NULL,finished_at=now() WHERE status='RUNNING' AND lease_expires_at<now() AND attempts>=5 RETURNING *`);
  for(const job of expired.rows)await client.query("INSERT INTO audit_logs(action,target_id,metadata) VALUES ('automation.failed',$1,$2)",[job.incident_id,JSON.stringify({jobId:job.id,errorCode:'LEASE_EXHAUSTED'})]);
  const {rows:[job]}=await client.query<AutomationJob>(`WITH candidate AS (SELECT id FROM automation_jobs WHERE attempts<5 AND ((status='QUEUED' AND next_attempt_at<=now()) OR (status='RUNNING' AND lease_expires_at<now())) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE automation_jobs j SET status='RUNNING',attempts=attempts+1,provider=COALESCE($2::text,j.provider),lease_token=$1,lease_expires_at=now()+interval '90 seconds' FROM candidate c WHERE j.id=c.id RETURNING j.*`,[randomUUID(),provider??null]);
  if(job)await client.query("INSERT INTO audit_logs(action,target_id,metadata) VALUES ('automation.started',$1,$2)",[job.incident_id,JSON.stringify({jobId:job.id,kind:job.kind,attempt:job.attempts})]);
  await client.query('COMMIT');return job??null;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export function validateAutomationResult(job:AutomationJob,input:unknown,provider:'local'|'windmill'='windmill'){
 const parsed=automationResult.parse(input);
 if(parsed.engine!==(provider==='local'?'LOCAL':'WINDMILL'))throw new Error('RESULT_PROVIDER_MISMATCH');
 if(parsed.jobId!==job.id||parsed.incidentId!==job.incident_id||parsed.kind!==job.kind)throw new Error('RESULT_MISMATCH');
 if(parsed.kind==='CONTAIN_SIMULATED'&&(parsed.responseId!==job.response_id||parsed.actor!==job.payload.actor))throw new Error('RESULT_MISMATCH');
 return parsed;
}
export async function settleAutomation(client:SqlClient,claimed:AutomationJob,outcome:{result:unknown}|{errorCode:string;retryable:boolean},provider:'local'|'windmill'='windmill'){
 // Validate before opening the transaction; never persist arbitrary remote output.
 const result='result' in outcome?validateAutomationResult(claimed,outcome.result,provider):null;
 await client.query('BEGIN');
 try{
  const {rows:[job]}=await client.query<AutomationJob>("SELECT * FROM automation_jobs WHERE id=$1 AND status='RUNNING' AND lease_token=$2 FOR UPDATE",[claimed.id,claimed.lease_token]);
  if(!job){await client.query('COMMIT');return false;}
  const retry=!result&&'retryable' in outcome&&outcome.retryable&&job.attempts<5;
  const status=result?'SUCCEEDED':retry?'QUEUED':'FAILED';
  const errorCode='errorCode' in outcome?outcome.errorCode:null;
  await client.query(`UPDATE automation_jobs SET status=$1,result=$2,error_code=$3,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=now()+($4::int*interval '1 second'),finished_at=CASE WHEN $1 IN ('SUCCEEDED','FAILED') THEN now() ELSE NULL END WHERE id=$5`,[status,result?JSON.stringify(result):null,errorCode,Math.min(300,5*2**(job.attempts-1)),job.id]);
  if(result&&job.kind==='CONTAIN_SIMULATED'){
   const {rows}=await client.query<{decided_by:string}>("UPDATE response_requests SET status='SUCCEEDED',result=$1 WHERE id=$2 AND status='APPROVED' RETURNING decided_by",[JSON.stringify(result),job.response_id]);
   if(!rows.length)throw new Error('APPROVAL_STATE_CHANGED');
   await client.query("INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,'response.simulated',$2,$3)",[rows[0].decided_by,job.incident_id,JSON.stringify({requestId:job.response_id,...result})]);
  }
  await client.query('INSERT INTO audit_logs(action,target_id,metadata) VALUES ($1,$2,$3)',[result?'automation.completed':retry?'automation.retry_scheduled':'automation.failed',job.incident_id,JSON.stringify({jobId:job.id,kind:job.kind,attempt:job.attempts,errorCode})]);
  await client.query('COMMIT');return true;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export class AutomationError extends Error {}
export async function retryAutomation(client:SqlClient,userId:string,jobId:string){
 z.string().uuid().parse(jobId);
 await client.query('BEGIN');
 try{
  const {rows:[user]}=await client.query<{role:string;disabled:boolean}>('SELECT role,disabled FROM users WHERE id=$1 FOR SHARE',[userId]);
  if(!user||user.disabled||user.role==='VIEWER')throw new AutomationError('Only active Analysts and Admins can retry a failed workflow.');
  const {rows:[job]}=await client.query<AutomationJob>('SELECT * FROM automation_jobs WHERE id=$1 FOR UPDATE',[jobId]);
  if(!job||job.status!=='FAILED')throw new AutomationError('Only failed workflows can be retried. Refresh this incident.');
  await client.query("UPDATE automation_jobs SET status='QUEUED',attempts=0,error_code=NULL,finished_at=NULL,next_attempt_at=now() WHERE id=$1",[job.id]);
  await client.query("INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,'automation.retry_requested',$2,$3)",[userId,job.incident_id,JSON.stringify({jobId:job.id,kind:job.kind})]);
  await client.query('COMMIT');return job.incident_id;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
