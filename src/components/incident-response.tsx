import { db } from '@/lib/db';
import type { User } from '@/lib/auth';
import type { ResponseRequest } from '@/lib/response';
import { ResponseForm } from './response-form';
import { automationProvider } from '@/lib/automation-provider';
export async function IncidentResponse({id,user,status,actor}:{id:string;user:User;status:string;actor:unknown}){
 const provider=automationProvider();const providerLabel=provider==='local'?'Local automation':'Windmill';
 const {rows:requests}=await db.query<ResponseRequest>(`SELECT r.*,u.email AS requester_email,d.email AS decider_email FROM response_requests r JOIN users u ON u.id=r.requested_by LEFT JOIN users d ON d.id=r.decided_by WHERE r.incident_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 50`,[id]);
 const pending=requests.some(request=>request.status==='PENDING'||request.status==='APPROVED');
 return <section className="panel"><div className="panel-heading"><div><h2>Response workflow <span className="count-pill">SIMULATION</span></h2><p>Request → independent Admin review → {providerLabel} execution → recorded outcome</p></div></div>
 <div className="response-body"><p className="response-notice">Approvals queue {providerLabel} to simulate containment of the evidence actor. No real account, device or network changes occur. Incident status remains a separate analyst decision.</p>
 {user.role==='VIEWER'?<p className="muted">Viewer access: read response history. An Analyst or Admin must request an action.</p>:pending?<p className="muted">A request is awaiting independent Admin review or automation completion.</p>:status==='RESOLVED'?<p className="muted">Reopen this incident to request a response.</p>:typeof actor!=='string'||!actor.trim()||actor.length>500?<p className="muted">This IP-centered or unassigned pattern is investigation-only. No account actor is inferred for simulated containment.</p>:<ResponseForm incidentId={id}/>}
 {!requests.length&&<p className="muted">No response requests yet.</p>}
 {requests.map(request=><article className="response-card" key={request.id}><div className="response-card-heading"><strong>Simulated actor containment</strong><span className="badge">{request.status==='SUCCEEDED'?'SIMULATION COMPLETED':request.status==='APPROVED'?'APPROVED · AWAITING AUTOMATION':request.status}</span></div><dl className="detail-grid"><div><dt>Target actor</dt><dd>{request.target_actor}</dd></div><div><dt>Requested by</dt><dd>{request.requester_email}</dd></div><div><dt>Requested (UTC)</dt><dd>{new Date(request.created_at).toISOString()}</dd></div></dl><p className="response-reason">{request.reason}</p>
 {request.status==='PENDING'&&user.role==='ADMIN'&&(request.requested_by===user.id?<p className="muted">A different Admin must decide this request. Use an Analyst to request and an Admin to review in the demo.</p>:<ResponseForm requestId={request.id}/>)}
 {request.decided_at&&<p className="response-reason">{request.decider_email} · {new Date(request.decided_at).toISOString()}<br/>{request.decision_note}</p>}
 {request.result&&<details className="evidence"><summary>Simulation receipt</summary><pre>{JSON.stringify(request.result,null,2)}</pre></details>}</article>)}
 </div><div className="panel-footer">Latest 50 requests · independent approval · atomic audit records</div></section>;
}
