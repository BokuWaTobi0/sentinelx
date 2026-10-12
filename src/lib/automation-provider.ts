import { randomUUID } from 'node:crypto';
import type { AutomationJob } from './automation';
import type { SqlClient } from './sql-client';

export type AutomationProvider='local'|'windmill';
export class AutomationProviderError extends Error { constructor(public code:string,public retryable=false){super(code);} }
export function automationProvider(env:Record<string,string|undefined>=process.env):AutomationProvider {
 const value=env.AUTOMATION_PROVIDER?.trim().toLowerCase()||'local';
 if(value==='local'||value==='windmill')return value;
 throw new AutomationProviderError('INVALID_AUTOMATION_PROVIDER');
}
export async function runLocal(job:AutomationJob,client?:SqlClient){
 const base={jobId:job.id,incidentId:job.incident_id,realWorldChanges:false as const,engine:'LOCAL' as const};
 if(job.kind==='INVESTIGATE'){
  const actor=typeof job.payload.actor==='string'?job.payload.actor:'unknown actor';
  const failures=typeof job.payload.failureCount==='number'?job.payload.failureCount:0;
  const sourceIps=Array.isArray(job.payload.sourceIps)?job.payload.sourceIps:[];
  return { ...base,kind:'INVESTIGATE' as const,summary:`${failures} failed login events for ${actor} were recorded in the immutable incident snapshot across ${sourceIps.length} source IP${sourceIps.length===1?'':'s'}.`,recommendation:'Review the linked evidence and confirm the activity with the account owner before taking any action.',failureCount:failures,sourceIpCount:sourceIps.length };
 }
 const requestedBy=job.payload.requestedBy,approvedBy=job.payload.approvedBy;
 if(job.payload.approved!==true||typeof requestedBy!=='string'||typeof approvedBy!=='string'||requestedBy===approvedBy||!job.response_id||typeof job.payload.actor!=='string'||!client)throw new AutomationProviderError('APPROVAL_INVALID');
 const {rows}=await client.query<{valid:boolean}>(`SELECT (r.status='APPROVED' AND r.requested_by::text=$2 AND r.decided_by::text=$3 AND r.target_actor=$4 AND requester.id<>approver.id AND NOT requester.disabled AND NOT approver.disabled AND approver.role='ADMIN') AS valid FROM response_requests r JOIN users requester ON requester.id=r.requested_by JOIN users approver ON approver.id=r.decided_by WHERE r.id=$1`,[job.response_id,requestedBy,approvedBy,job.payload.actor]);
 if(!rows[0]?.valid)throw new AutomationProviderError('APPROVAL_INVALID');
 return {...base,kind:'CONTAIN_SIMULATED' as const,responseId:job.response_id,actor:job.payload.actor,action:'CONTAIN_ACTOR' as const,mode:'SIMULATION' as const,message:'Simulated containment recorded locally. No account, network or device was changed.'};
}
