'use client';
import { useActionState } from 'react';
import { responseAction,type ResponseState } from '@/app/incidents/response-actions';
import { SubmitButton } from './submit-button';
export function ResponseForm({incidentId,requestId}:{incidentId?:string;requestId?:string}){
 const [state,action]=useActionState<ResponseState,FormData>(responseAction,{});
 return <form action={action} className="response-form">
 <input type="hidden" name="operation" value={requestId?'decide':'request'}/>
 <input type="hidden" name={requestId?'requestId':'incidentId'} value={requestId??incidentId}/>
 {requestId&&<label>Decision<select name="decision" defaultValue="REJECT"><option value="REJECT">Reject request</option><option value="APPROVE">Approve simulated containment</option></select></label>}
 <label>{requestId?'Decision note':'Why is containment needed?'}<textarea name={requestId?'note':'reason'} required minLength={10} maxLength={1000} rows={3} placeholder="Explain the evidence supporting your decision."/></label>
 <SubmitButton>{requestId?'Record decision':'Request simulated containment'}</SubmitButton>
 {state.error&&<p className="response-error" role="alert">{state.error}</p>}{state.success&&<p className="response-success" role="status">{state.success}</p>}
 </form>;
}
