import { z } from 'zod';
import { enqueueAutomation } from './automation';
import type { SqlClient } from './sql-client';
import type { Role } from './rbac';

export class ResponseError extends Error {}
export const requestSchema=z.object({incidentId:z.string().uuid(),reason:z.string().trim().min(10).max(1000)});
export const decisionSchema=z.object({requestId:z.string().uuid(),decision:z.enum(['APPROVE','REJECT']),note:z.string().trim().min(10).max(1000)});
type Identity={id:string;role:Role};
export type ResponseRequest={id:string;incident_id:string;requested_by:string;target_actor:string;reason:string;status:'PENDING'|'APPROVED'|'SUCCEEDED'|'REJECTED';decided_by:string|null;decision_note:string|null;result:Record<string,unknown>|null;created_at:Date;decided_at:Date|null;requester_email:string;decider_email:string|null};
async function activeIdentity(client:SqlClient,identity:Identity){
 const {rows:[user]}=await client.query<{role:Role;disabled:boolean}>('SELECT role,disabled FROM users WHERE id=$1 FOR SHARE',[identity.id]);
 if(!user||user.disabled)throw new ResponseError('Your account is unavailable. Sign in again.');
 return user;
}
export async function requestResponse(client:SqlClient,identity:Identity,input:unknown){
 const data=requestSchema.parse(input);
 await client.query('BEGIN');
 try {
  const user=await activeIdentity(client,identity);
  if(user.role==='VIEWER')throw new ResponseError('Only Analysts and Admins can request a response.');
  const {rows:[incident]}=await client.query<{status:string;evidence:Record<string,unknown>}>('SELECT status,evidence FROM alerts WHERE id=$1 FOR UPDATE',[data.incidentId]);
  if(!incident)throw new ResponseError('Incident not found.');
  if(incident.status==='RESOLVED')throw new ResponseError('Reopen this incident before requesting a response.');
  const actor=incident.evidence.actor;
  if(typeof actor!=='string'||!actor.trim()||actor.length>500)throw new ResponseError('This incident has no valid actor in its evidence snapshot.');
  const {rows:[request]}=await client.query<{id:string}>(`INSERT INTO response_requests(incident_id,requested_by,target_actor,reason) VALUES ($1,$2,$3,$4) ON CONFLICT (incident_id) WHERE status IN ('PENDING','APPROVED') DO NOTHING RETURNING id`,[data.incidentId,identity.id,actor,data.reason]);
  if(!request)throw new ResponseError('A response request is already awaiting approval or workflow completion for this incident.');
  await client.query("INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,'response.requested',$2,$3)",[identity.id,data.incidentId,JSON.stringify({requestId:request.id,actor,reason:data.reason,mode:'SIMULATION'})]);
  await client.query('COMMIT');return request.id;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function decideResponse(client:SqlClient,identity:Identity,input:unknown){
 const data=decisionSchema.parse(input);
 await client.query('BEGIN');
 try{
  const user=await activeIdentity(client,identity);
  if(user.role!=='ADMIN')throw new ResponseError('Only Admins can approve or reject responses.');
  // Always lock incident before request, matching the request and status-update lock order.
  const {rows:[reference]}=await client.query<{incident_id:string}>('SELECT incident_id FROM response_requests WHERE id=$1',[data.requestId]);
  if(!reference)throw new ResponseError('Response request not found.');
  const {rows:[incident]}=await client.query<{status:string}>('SELECT status FROM alerts WHERE id=$1 FOR UPDATE',[reference.incident_id]);
  const {rows:[request]}=await client.query<ResponseRequest>('SELECT * FROM response_requests WHERE id=$1 FOR UPDATE',[data.requestId]);
  if(request.status!=='PENDING')throw new ResponseError('This request has already been decided. Refresh to see its outcome.');
  if(request.requested_by===identity.id)throw new ResponseError('A different Admin must review your request. Self-approval and self-rejection are disabled.');
  if(data.decision==='APPROVE'&&incident.status==='RESOLVED')throw new ResponseError('This incident is resolved. Reject the request or reopen the incident before approval.');
  const result=data.decision==='APPROVE'?{mode:'SIMULATION',action:'CONTAIN_ACTOR',actor:request.target_actor,realWorldChanges:false,message:'Simulated containment recorded. No account, network or device was changed.'}:null;
  await client.query('UPDATE response_requests SET status=$1,decided_by=$2,decision_note=$3,result=$4,decided_at=now() WHERE id=$5',[result?'APPROVED':'REJECTED',identity.id,data.note,null,request.id]);
  await client.query('INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,$2,$3,$4)',[identity.id,result?'response.approved':'response.rejected',request.incident_id,JSON.stringify({requestId:request.id,note:data.note,actor:request.target_actor,mode:'SIMULATION'})]);
  if(result)await enqueueAutomation(client,request.incident_id,'CONTAIN_SIMULATED',{actor:request.target_actor,approved:true,requestedBy:request.requested_by,approvedBy:identity.id},request.id);
  await client.query('COMMIT');return request.incident_id;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
