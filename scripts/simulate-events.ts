import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { parseBatch, type SecurityEvent } from '../src/lib/event-schema';
const key=process.env.INGEST_API_KEY;
if(!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Run npm.cmd run ingest:setup first, then restart the app.');
const base=new URL(process.env.SENTINELX_URL ?? 'http://localhost:3000');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.username||base.password)
 throw new Error('This local simulator only sends to localhost/127.0.0.1/::1.');
const mode=process.argv[2]??'mixed';
if(!['normal','burst','mixed','password-spray','ip-failures','success-after-burst'].includes(mode)) throw new Error('Usage: npm.cmd run simulate -- normal|burst|mixed|password-spray|ip-failures|success-after-burst [burst-actor]');
const burstActor=process.argv[3]??'demo-target';
if(!/^[a-zA-Z0-9_.@-]{1,128}$/.test(burstActor)) throw new Error('Use a short actor name containing letters, numbers, _, ., @ or -');
const now=Date.now();
function event(actor:string,eventType:SecurityEvent['eventType'],index:number,scenario:'normal'|'login-burst'|'password-spray'|'ip-failures'|'success-after-burst',sourceIp?:string,offsetMs?:number):SecurityEvent {
 return {id:randomUUID(),occurredAt:new Date(now+(offsetMs??(-55000+index*3000))).toISOString(),source:'sentinelx-simulator',eventType,actor,sourceIp:sourceIp??(scenario==='login-burst'?'192.0.2.50':`192.0.2.${10+index}`),payload:{demo:true,scenario,hostname:'demo-workstation',reason:eventType==='LOGIN_FAILURE'?'Invalid demo password':'Simulated sign-in'}};
}
const events:SecurityEvent[]=[];
if(mode==='normal'||mode==='mixed')for(let i=0;i<12;i++)events.push(event(`demo-user-${i%4+1}`,i===3?'LOGIN_FAILURE':'LOGIN_SUCCESS',i,'normal'));
if(mode==='burst'||mode==='mixed')for(let i=0;i<8;i++)events.push(event(burstActor,'LOGIN_FAILURE',i,'login-burst'));
if(mode==='password-spray')for(let i=0;i<5;i++)events.push(event(`spray-user-${i+1}`,'LOGIN_FAILURE',i,'password-spray','203.0.113.201',-300000+i*75000));
if(mode==='ip-failures')for(let i=0;i<10;i++)events.push(event(`shared-ip-user-${i%2+1}`,'LOGIN_FAILURE',i,'ip-failures','203.0.113.202',-540000+i*60000));
if(mode==='success-after-burst'){
 for(let i=0;i<5;i++)events.push(event(burstActor,'LOGIN_FAILURE',i,'success-after-burst','203.0.113.203',-240000+i*15000));
 events.push(event(burstActor,'LOGIN_SUCCESS',5,'success-after-burst','203.0.113.203',-164000));
}
if(!parseBatch({events}).success) throw new Error('Simulator produced invalid events');
// Keep the same event IDs/body for network and 5xx retries.
const body=JSON.stringify({events});
const url=new URL('/api/events',base);
for(let attempt=1;attempt<=3;attempt++) {
 try {
  const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(10000),redirect:'error'});
  const result=await response.text();
  if(response.status>=500 && attempt<3){await setTimeout(1000);continue;}
  if(!response.ok) {console.error(`Ingestion rejected (${response.status}): ${result}`);process.exitCode=1;break;}
  console.log(`Sent ${events.length} simulated events (${mode}). ${result}`);
  console.log(`Open ${new URL('/events',base)}. Filter actor=${burstActor} for actor scenarios, or review the IP-centered incident for ${mode}.`);
  break;
 } catch(error) {
  if(attempt===3){console.error('Unable to reach SentinelX. Keep npm.cmd run dev running and check SENTINELX_URL if using another port.');process.exitCode=1;break;}
  await setTimeout(1000);
 }
}
