import { migrations } from './migrations';
import { windmillConfig } from './windmill';
export function configurationChecks(env:Record<string,string|undefined>){
 const checks=[{name:'Database URL configured',passed:Boolean(env.DATABASE_URL?.trim())},{name:'Ingestion key configured',passed:/^[a-f0-9]{64}$/.test(env.INGEST_API_KEY??'')}];
 try{windmillConfig(env);checks.push({name:'Windmill settings valid',passed:true});}catch{checks.push({name:'Windmill settings valid',passed:false});}
 return checks;
}
export function migrationReady(applied:string[]){return migrations.every(version=>applied.includes(version));}
