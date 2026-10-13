import {z} from 'zod';
import type {SqlClient} from './sql-client';
export const DETECTION_LOCK=81422;
export const ruleIds=['failed-login-burst-v1','password-spray-v1','ip-failures-across-actors-v1','success-after-failure-burst-v1'] as const;
export const defaultDetectionRules={
 'failed-login-burst-v1':{enabled:true,failureThreshold:5,windowSeconds:60,cooldownSeconds:60},
 'password-spray-v1':{enabled:true,failureThreshold:5,distinctActorThreshold:5,windowSeconds:300,cooldownSeconds:300},
 'ip-failures-across-actors-v1':{enabled:true,failureThreshold:10,distinctActorThreshold:2,windowSeconds:600,cooldownSeconds:600},
 'success-after-failure-burst-v1':{enabled:true,failureThreshold:5,failureWindowSeconds:60,lookbackSeconds:300,cooldownSeconds:300},
} as const;
const bounded=(min:number,max:number)=>z.number().int().min(min).max(max);
const window=bounded(10,3600),cooldown=z.number().int().min(0).max(86400),count=bounded(2,100);
export const detectionRulesSchema=z.object({
 'failed-login-burst-v1':z.object({enabled:z.boolean(),failureThreshold:count,windowSeconds:window,cooldownSeconds:cooldown}).strict(),
 'password-spray-v1':z.object({enabled:z.boolean(),failureThreshold:count,distinctActorThreshold:count,windowSeconds:window,cooldownSeconds:cooldown}).strict().superRefine((r,c)=>{if(r.distinctActorThreshold>r.failureThreshold)c.addIssue({code:'custom',path:['distinctActorThreshold'],message:'Distinct actors cannot exceed the failure threshold'});}),
 'ip-failures-across-actors-v1':z.object({enabled:z.boolean(),failureThreshold:count,distinctActorThreshold:count,windowSeconds:window,cooldownSeconds:cooldown}).strict().superRefine((r,c)=>{if(r.distinctActorThreshold>r.failureThreshold)c.addIssue({code:'custom',path:['distinctActorThreshold'],message:'Distinct actors cannot exceed the failure threshold'});}),
 'success-after-failure-burst-v1':z.object({enabled:z.boolean(),failureThreshold:count,failureWindowSeconds:window,lookbackSeconds:window,cooldownSeconds:cooldown}).strict().superRefine((r,c)=>{if(r.failureWindowSeconds>r.lookbackSeconds)c.addIssue({code:'custom',path:['lookbackSeconds'],message:'Lookback must cover the failure window'});}),
}).strict();
export type DetectionRules=z.infer<typeof detectionRulesSchema>;
export type DetectionConfig={version:number;rules:DetectionRules};
export class DetectionConfigConflict extends Error{}
export async function saveDetectionConfig(client:SqlClient,adminId:string,expectedVersion:number,input:unknown){
 const rules=detectionRulesSchema.parse(input);await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock($1)',[DETECTION_LOCK]);
  const {rows:[current]}=await client.query<{version:number;rules:unknown}>('SELECT c.version,v.rules FROM detection_config_current c JOIN detection_config_versions v USING(version) WHERE c.singleton=true FOR UPDATE OF c');
  if(!current)throw new Error('Detection configuration has not been initialized.');
  if(current.version!==expectedVersion)throw new DetectionConfigConflict('Detection rules changed since this page was loaded. Reload and review the current values.');
  const prior=detectionRulesSchema.parse(current.rules);
  if(JSON.stringify(prior)===JSON.stringify(rules)){await client.query('COMMIT');return current.version;}
  const version=current.version+1;
  await client.query('INSERT INTO detection_config_versions(version,rules,changed_by) VALUES ($1,$2,$3)',[version,JSON.stringify(rules),adminId]);
  await client.query('UPDATE detection_config_current SET version=$1 WHERE singleton=true',[version]);
  await client.query("INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,'detection.configuration_updated',$2,$3)",[adminId,String(version),JSON.stringify({fromVersion:current.version,toVersion:version,previous:prior,next:rules})]);
  await client.query('COMMIT');return version;
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export const ruleDescriptions:Record<(typeof ruleIds)[number],string>={
 'failed-login-burst-v1':'Failures for one exact actor label in an inclusive trailing event-time window.',
 'password-spray-v1':'Failed events and distinct actor labels from one parsed source IP in an inclusive trailing window.',
 'ip-failures-across-actors-v1':'Failure volume and distinct actor labels for one source IP in an inclusive trailing window.',
 'success-after-failure-burst-v1':'A successful login within the lookback after a qualifying failure burst for one actor label.',
};
export async function currentDetectionConfig(client:SqlClient):Promise<DetectionConfig>{
 const {rows:[row]}=await client.query<{version:number;rules:unknown}>('SELECT c.version,v.rules FROM detection_config_current c JOIN detection_config_versions v USING(version) WHERE c.singleton=true');
 if(!row)throw new Error('Detection configuration has not been initialized.');
 return {version:row.version,rules:detectionRulesSchema.parse(row.rules)};
}
