export const SCORING_VERSION='priority-v1';
export type ScoreFactor={key:string;label:string;points:number;explanation:string};
export type IncidentScore={score:number;band:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';version:string;factors:ScoreFactor[]};
const bases:Record<string,{points:number;label:string}>={
 'failed-login-burst-v1':{points:20,label:'Repeated failures for one actor label'},
 'password-spray-v1':{points:25,label:'Failures across distinct actor labels from one IP'},
 'ip-failures-across-actors-v1':{points:20,label:'Repeated failures across actor labels from one IP'},
 'success-after-failure-burst-v1':{points:25,label:'Successful login after a failure burst'},
};
export function priorityBand(score:number):IncidentScore['band'] { return score>=80?'CRITICAL':score>=60?'HIGH':score>=30?'MEDIUM':'LOW'; }
export function scoreIncident(evidence:Record<string,unknown>):IncidentScore|null {
 const detector=typeof evidence.detector==='string'?evidence.detector:'';const base=bases[detector];
 const rawCount=typeof evidence.failureCount==='number'?evidence.failureCount:typeof evidence.eventCount==='number'?evidence.eventCount:NaN;
 const ids=evidence.eventIds;
 if(!base||!Number.isInteger(rawCount)||rawCount<1||!Array.isArray(ids)||ids.length===0)return null;
 const count=Math.min(rawCount,10000);const factors:ScoreFactor[]=[{key:'detection_rule',label:base.label,points:base.points,explanation:`Day 8 rule ${detector} matched immutable evidence.`}];
 const volume=Math.min(30,Math.max(0,Math.floor((count-5)/5)*5));
 factors.push({key:'failure_volume',label:'Failure volume',points:volume,explanation:`${rawCount} recorded failure${rawCount===1?'':'s'}; +5 per five beyond the first five, capped at 30.`});
 const actorCount=typeof evidence.actorCount==='number'?evidence.actorCount:(typeof evidence.actor==='string'?1:0);
 const actorPoints=Math.min(20,Math.max(0,(actorCount-1)*5));
 const rawIps=Array.isArray(evidence.sourceIps)?evidence.sourceIps:(typeof evidence.sourceIp==='string'?[evidence.sourceIp]:[]);
 const ipCount=new Set(rawIps.filter((x):x is string=>typeof x==='string')).size;
 const ipPoints=Math.min(10,Math.max(0,(ipCount-1)*5));
 factors.push({key:'distinct_context',label:'Distinct actor labels and source IPs',points:actorPoints+ipPoints,explanation:`${actorCount} distinct actor label${actorCount===1?'':'s'} and ${ipCount} source IP${ipCount===1?'':'s'} recorded; actor labels are unverified. Actor and IP points are capped at 20 and 10.`});
 if(detector==='success-after-failure-burst-v1')factors.push({key:'success_after_failures',label:'Success after failures',points:25,explanation:'A successful login event follows the qualifying failure burst in the frozen detector evidence.'});
 const score=Math.min(100,factors.reduce((n,f)=>n+f.points,0));return {score,band:priorityBand(score),version:SCORING_VERSION,factors};
}
