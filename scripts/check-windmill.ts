import { randomUUID } from 'node:crypto';
import { windmillConfig,runWindmill,WindmillError } from '../src/lib/windmill';
import type { AutomationJob } from '../src/lib/automation';
import { automationProvider,runLocal } from '../src/lib/automation-provider';
const id=randomUUID(),incidentId=randomUUID();
const job:AutomationJob={id,incident_id:incidentId,response_id:null,kind:'INVESTIGATE',status:'RUNNING',payload:{jobId:id,incidentId,kind:'INVESTIGATE',responseId:null,actor:'connection-check-demo',failureCount:8,sourceIps:['192.0.2.10'],windowSeconds:60,demo:true},result:null,attempts:1,lease_token:null,error_code:null,created_at:new Date(),finished_at:null};
try{
 const provider=automationProvider();
 const result=provider==='local'?await runLocal(job):await runWindmill(job,windmillConfig());
 console.log(`${provider==='local'?'Local automation':'Windmill'} provider and result contract verified. This check made no database or containment changes.`);
 console.log(JSON.stringify(result,null,2));
}catch(error){
 console.error(error instanceof WindmillError?`Connection check failed: ${error.code}`:error instanceof Error?`Automation check failed: ${error.message}`:'Automation check failed.');
 process.exitCode=1;
}
