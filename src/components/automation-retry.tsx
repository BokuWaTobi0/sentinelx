'use client';
import { useActionState } from 'react';
import { retryWorkflow } from '@/app/incidents/automation-actions';
import { SubmitButton } from './submit-button';
export function AutomationRetry({id}:{id:string}){
 const [state,action]=useActionState<{error?:string;success?:string},FormData>(retryWorkflow,{});
 return <form action={action} className="response-form"><input type="hidden" name="jobId" value={id}/><SubmitButton className="button secondary">Retry failed workflow</SubmitButton>{state.error&&<p role="alert" className="response-error">{state.error}</p>}{state.success&&<p role="status" className="response-success">{state.success}</p>}</form>;
}
