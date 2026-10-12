'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { requestResponse,decideResponse,ResponseError } from '@/lib/response';
import { automationProvider } from '@/lib/automation-provider';
export type ResponseState={error?:string;success?:string};
export async function responseAction(_previous:ResponseState,form:FormData):Promise<ResponseState>{
 const user=await requireUser();
 const provider=automationProvider();
 let client;
 try{
  client=await db.connect();
  const input=Object.fromEntries(form);
  let incidentId:string;
  if(input.operation==='request')incidentId=String(input.incidentId),await requestResponse(client,user,input);
  else if(input.operation==='decide')incidentId=await decideResponse(client,user,input);
  else return {error:'Unknown response operation.'};
  revalidatePath(`/incidents/${incidentId}`);revalidatePath('/admin');
  return {success:input.operation==='request'?'Request submitted for independent Admin review.':input.decision==='APPROVE'?`Approved. Simulated containment queued for ${provider==='local'?'Local automation':'Windmill'}; completion will appear after the worker finishes.`:'Request rejected.'};
 }catch(error){
  if(error instanceof ResponseError)return {error:error.message};
  if(error instanceof z.ZodError)return {error:'Provide valid identifiers and a reason or decision note between 10 and 1,000 characters.'};
  console.error('Response workflow failed',error);
  return {error:'Unable to save the response. Check the server terminal and database connection, then retry.'};
 }finally{client?.release();}
}
