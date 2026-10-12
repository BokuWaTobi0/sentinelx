import { Pool } from 'pg';
import { claimAutomation,settleAutomation } from '../src/lib/automation';
import { windmillConfig,runWindmill,WindmillError } from '../src/lib/windmill';
const once=process.argv.includes('--once');
const config=windmillConfig(); // Fail before claiming jobs if configuration is missing.
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2});
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
console.log('Windmill worker started. Only investigation and simulated containment are supported.');
try{
 do{
  const client=await pool.connect();
  try{
   const job=await claimAutomation(client);
   if(job){
    try{const result=await runWindmill(job,config);const saved=await settleAutomation(client,job,{result});console.log(`${job.id}: ${saved?'completed':'lease superseded; result ignored'} ${job.kind}`);}
    catch(error){
     if(!(error instanceof WindmillError))throw error;
     await settleAutomation(client,job,{errorCode:error.code,retryable:error.retryable});console.log(`${job.id}: ${error.code}; attempt ${job.attempts}/5`);
    }
   }else if(once)console.log('No eligible queued job.');
  }finally{client.release();}
  if(!once&&!stopping)await new Promise(resolve=>setTimeout(resolve,2000));
 }while(!once&&!stopping);
}finally{await pool.end();}
