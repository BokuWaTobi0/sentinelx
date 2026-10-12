import { migrations } from './migrations';
import { windmillConfig } from './windmill';
import { automationProvider } from './automation-provider';
export function configurationChecks(env:Record<string,string|undefined>){
 const checks=[{name:'Database URL configured',passed:Boolean(env.DATABASE_URL?.trim())},{name:'Ingestion key configured',passed:/^[a-f0-9]{64}$/.test(env.INGEST_API_KEY??'')}];
 try{const provider=automationProvider(env);if(provider==='windmill')windmillConfig(env);checks.push({name:`${provider==='local'?'Local automation':'Windmill'} settings valid`,passed:true});}catch(error){checks.push({name:error instanceof Error&&error.message==='INVALID_AUTOMATION_PROVIDER'?'Automation provider supported':'Selected automation provider settings valid',passed:false});}
 return checks;
}
export function migrationReady(applied:string[]){return migrations.every(version=>applied.includes(version));}
