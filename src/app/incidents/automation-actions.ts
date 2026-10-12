'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { AutomationError,retryAutomation } from '@/lib/automation';
export async function retryWorkflow(_state:{error?:string;success?:string},form:FormData){
 const user=await requireUser();let client;
 try{
  client=await db.connect();
  const id=z.string().uuid().parse(form.get('jobId'));
  const incidentId=await retryAutomation(client,user.id,id);
  revalidatePath(`/incidents/${incidentId}`);revalidatePath('/admin');
  return {success:'Workflow queued again. Refresh after the worker processes it.'};
 }catch(error){
  if(error instanceof AutomationError)return {error:error.message};
  if(error instanceof z.ZodError)return {error:'Invalid workflow identifier.'};
  console.error('automation retry failed',error);return {error:'Unable to retry. Check the server terminal and database.'};
 }finally{client?.release();}
}
