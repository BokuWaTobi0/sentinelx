import { Pool } from 'pg';
import { claimAutomation,settleAutomation } from '../src/lib/automation';
import { windmillConfig,runWindmill,WindmillError } from '../src/lib/windmill';
import { automationProvider,runLocal,AutomationProviderError } from '../src/lib/automation-provider';
const once=process.argv.includes('--once');
const provider=automationProvider();
const config=provider==='windmill'?windmillConfig():undefined; // Validate external credentials before claiming jobs.
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2});
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
console.log(`${provider==='local'?'Local automation':'Windmill'} worker started. Only investigation and simulated containment are supported.`);
try{
 do{
  const client=await pool.connect();
  try{
   const job=await claimAutomation(client,provider==='local'?'LOCAL':'WINDMILL');
   if(job){
    try{const result=provider==='local'?await runLocal(job,client):await runWindmill(job,config!);const saved=await settleAutomation(client,job,{result},provider);console.log(`${job.id}: ${saved?'completed':'lease superseded; result ignored'} ${job.kind}`);}
    catch(error){
     if(error instanceof AutomationProviderError){await settleAutomation(client,job,{errorCode:error.code,retryable:error.retryable},provider);console.log(`${job.id}: ${error.code}; attempt ${job.attempts}/5`);}
     else if(error instanceof WindmillError){await settleAutomation(client,job,{errorCode:error.code,retryable:error.retryable},provider);console.log(`${job.id}: ${error.code}; attempt ${job.attempts}/5`);}
     else throw error;
    }
   }else if(once)console.log('No eligible queued job.');
  }finally{client.release();}
  if(!once&&!stopping)await new Promise(resolve=>setTimeout(resolve,2000));
 }while(!once&&!stopping);
}finally{await pool.end();}
