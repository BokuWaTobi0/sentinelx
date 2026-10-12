import { db } from '@/lib/db';
import type { User } from '@/lib/auth';
import type { AutomationJob } from '@/lib/automation';
import { windmillConfig } from '@/lib/windmill';
import { AutomationRetry } from './automation-retry';
const explanations:Record<string,string>={NOT_CONFIGURED:'Configure the Windmill webhook URL and token, then start the worker.',HTTP_401:'Windmill rejected the token. Check its validity and flow permissions.',HTTP_403:'The token cannot run this flow. Check its scope.',HTTP_404:'Flow or workspace not found. Check the deployed flow and webhook URL.',INVALID_RESULT:'The flow returned an unexpected result. Deploy the included flow and retry.',TIMEOUT:'Windmill did not finish within 30 seconds. Check Windmill runs before retrying.',NETWORK_ERROR:'The worker could not reach Windmill.',INVALID_RESULT_BODY:'Windmill returned invalid or oversized JSON.',LEASE_EXHAUSTED:'The worker stopped repeatedly before recording an outcome.'};
export async function IncidentAutomation({id,user}:{id:string;user:User}){
 const {rows:jobs}=await db.query<AutomationJob>('SELECT * FROM automation_jobs WHERE incident_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',[id]);
 let configured=true;try{windmillConfig();}catch{configured=false;}
 return <section className="panel"><div className="panel-heading"><div><h2>Windmill automation <span className="count-pill">DAY 6</span></h2><p>Durable queue · investigation reports · approved simulated responses</p></div><span className="badge">{configured?'CONFIGURED':'SETUP REQUIRED'}</span></div><div className="response-body">
 <p className="response-notice">{configured?'Configuration is present. Keep the automation worker running and refresh to see outcomes.':'Add the Windmill webhook URL and token to .env, restart the app, and start the worker using DAY6.md. Jobs remain safely queued until then.'}</p>
 {!jobs.length&&<p className="muted">No queued workflows for this incident. Generate a new Day 6 burst to trigger an investigation, or approve a new response request.</p>}
 {jobs.map(job=><article key={job.id} className="response-card"><div className="response-card-heading"><strong>{job.kind==='INVESTIGATE'?'Automated investigation':'Approved simulated containment'}</strong><span className="badge">{job.status}</span></div><dl className="detail-grid"><div><dt>Attempts</dt><dd>{job.attempts} / 5</dd></div><div><dt>Queued (UTC)</dt><dd>{new Date(job.created_at).toISOString()}</dd></div><div><dt>Completed (UTC)</dt><dd>{job.finished_at?new Date(job.finished_at).toISOString():'Awaiting completion'}</dd></div></dl>
 {job.error_code&&<p className="response-error">{job.error_code}: {explanations[job.error_code]??'Check the worker terminal and Windmill run history.'}{job.status==='QUEUED'?' A retry is scheduled.':''}</p>}
 {job.result&&<><p className="response-reason">{typeof job.result.summary==='string'?job.result.summary:typeof job.result.message==='string'?job.result.message:''}</p>{typeof job.result.recommendation==='string'&&<p className="response-reason"><strong>Recommendation:</strong> {job.result.recommendation}</p>}<details className="evidence"><summary>Workflow result</summary><pre>{JSON.stringify(job.result,null,2)}</pre></details></>}
 {job.status==='FAILED'&&user.role!=='VIEWER'&&<AutomationRetry id={job.id}/>}<p className="subtle-label">Job {job.id}</p></article>)}
 </div><div className="panel-footer">Latest 50 jobs · investigation uses the detection snapshot · no real containment</div></section>;
}
