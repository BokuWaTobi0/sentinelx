'use server';
import {requirePermission} from '@/lib/auth';
import {db} from '@/lib/db';
import {detectionRulesSchema,saveDetectionConfig,DetectionConfigConflict} from '@/lib/detection-config';
import {z} from 'zod';
export type RuleConfigState={error?:string;success?:string};
export async function saveDetectionRules(_state:RuleConfigState,form:FormData):Promise<RuleConfigState>{
 const user=await requirePermission('rules:manage');const expectedResult=z.coerce.number().int().positive().safeParse(form.get('version'));if(!expectedResult.success)return {error:'Reload the current configuration and try again.'};const expected=expectedResult.data;
 const number=(key:string)=>Number(form.get(key)??'NaN');const enabled=(key:string)=>form.get(key)==='on';
 const rules={
  'failed-login-burst-v1':{enabled:enabled('failed-login-burst-v1.enabled'),failureThreshold:number('failed-login-burst-v1.failureThreshold'),windowSeconds:number('failed-login-burst-v1.windowSeconds'),cooldownSeconds:number('failed-login-burst-v1.cooldownSeconds')},
  'password-spray-v1':{enabled:enabled('password-spray-v1.enabled'),failureThreshold:number('password-spray-v1.failureThreshold'),distinctActorThreshold:number('password-spray-v1.distinctActorThreshold'),windowSeconds:number('password-spray-v1.windowSeconds'),cooldownSeconds:number('password-spray-v1.cooldownSeconds')},
  'ip-failures-across-actors-v1':{enabled:enabled('ip-failures-across-actors-v1.enabled'),failureThreshold:number('ip-failures-across-actors-v1.failureThreshold'),distinctActorThreshold:number('ip-failures-across-actors-v1.distinctActorThreshold'),windowSeconds:number('ip-failures-across-actors-v1.windowSeconds'),cooldownSeconds:number('ip-failures-across-actors-v1.cooldownSeconds')},
  'success-after-failure-burst-v1':{enabled:enabled('success-after-failure-burst-v1.enabled'),failureThreshold:number('success-after-failure-burst-v1.failureThreshold'),failureWindowSeconds:number('success-after-failure-burst-v1.failureWindowSeconds'),lookbackSeconds:number('success-after-failure-burst-v1.lookbackSeconds'),cooldownSeconds:number('success-after-failure-burst-v1.cooldownSeconds')},
 };
 const parsed=detectionRulesSchema.safeParse(rules);if(!parsed.success)return {error:parsed.error.issues.map(issue=>issue.message).join(' ')};
 let client;try{client=await db.connect();const version=await saveDetectionConfig(client,user.id,expected,parsed.data);return {success:`Detection configuration saved as version ${version}. New ingested events use it prospectively.`};}
 catch(error){return {error:error instanceof DetectionConfigConflict?error.message:'Unable to save detection rules. Review the values and retry.'};}finally{client?.release();}
}
