import { updateAlert } from '@/app/dashboard/actions';
import { SubmitButton } from './submit-button';
export function IncidentStatus({id,status,title}:{id:string;status:string;title:string}){
 return <form key={`${id}-${status}`} action={updateAlert} className="status-form"><input type="hidden" name="id" value={id}/><label><span className="sr-only">Status for {title}</span><select name="status" defaultValue={status}><option value="OPEN">Open</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="RESOLVED">Resolved</option></select></label><SubmitButton className="button secondary small-button">Update status</SubmitButton></form>;
}
