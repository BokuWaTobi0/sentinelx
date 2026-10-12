import { BodyTooLarge,readBoundedJson } from './ingest-http';
import { validateAutomationResult,type AutomationJob } from './automation';
export class WindmillError extends Error{constructor(public code:string,public retryable:boolean){super(code);}}
export function windmillConfig(env:Record<string,string|undefined>=process.env){
 if(!env.WINDMILL_WEBHOOK_URL||!env.WINDMILL_TOKEN)throw new WindmillError('NOT_CONFIGURED',false);
 let url:URL;try{url=new URL(env.WINDMILL_WEBHOOK_URL);}catch{throw new WindmillError('INVALID_WEBHOOK_URL',false);}
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password||url.search||url.hash||!/^\/api\/w\/[^/]+\/jobs\/run_wait_result\/(f\/|fv\/)/.test(url.pathname))throw new WindmillError('INVALID_WEBHOOK_URL',false);
 const token=env.WINDMILL_TOKEN.trim();if(!token||/[\r\n]/.test(token))throw new WindmillError('INVALID_TOKEN',false);
 return {url:url.toString(),token};
}
export async function runWindmill(job:AutomationJob,config:ReturnType<typeof windmillConfig>,fetcher:typeof fetch=fetch){
 let response:Response;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
 try{
  response=await fetcher(config.url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.token}`},body:JSON.stringify({payload:job.payload}),signal:controller.signal});
  if(!response.ok)throw new WindmillError(`HTTP_${response.status}`,response.status>=500||[408,429].includes(response.status));
  let data:unknown;
  try{data=await readBoundedJson(new Request('http://local/result',{method:'POST',body:response.body,duplex:'half'} as RequestInit));}
  catch(error){if(controller.signal.aborted)throw new WindmillError('TIMEOUT',true);if(error instanceof SyntaxError||error instanceof BodyTooLarge||error instanceof TypeError)throw new WindmillError('INVALID_RESULT_BODY',false);throw new WindmillError('NETWORK_ERROR',true);}
  try{return validateAutomationResult(job,data,'windmill');}catch{throw new WindmillError('INVALID_RESULT',false);}
 }catch(error){
  if(error instanceof WindmillError)throw error;
  throw new WindmillError(controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR',true);
 }finally{clearTimeout(timeout);}
}
