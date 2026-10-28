import type {SqlClient} from './sql-client';
export type NotificationKind='INCIDENT_NEW'|'STATUS_CHANGED'|'ASSIGNED'|'INVESTIGATION_REQUESTED'|'RESPONSE_REVIEW_REQUESTED'|'RESPONSE_DECIDED'|'ESCALATION_CREATED'|'ESCALATION_ACKNOWLEDGED'|'ESCALATION_STARTED'|'ESCALATION_COMPLETED'|'ESCALATION_REASSIGNED';
export async function notifyUsers(client:SqlClient,recipients:string[],input:{incidentId:string;kind:NotificationKind;title:string;message:string;dedupeKey:string;requiredRole?:'VIEWER'|'ANALYST'|'ADMIN';excludedId?:string}){
 if(!recipients.length)return 0;
 const {rows}=await client.query<{id:string}>(`INSERT INTO notifications(recipient_id,incident_id,kind,title,message,dedupe_key)
  SELECT u.id,$2,$3,$4,$5,$6 FROM users u WHERE u.id=ANY($1::uuid[]) AND NOT u.disabled
   AND ($7::text IS NULL OR u.role=$7) AND ($8::uuid IS NULL OR u.id<>$8::uuid)
  ON CONFLICT(recipient_id,dedupe_key) DO NOTHING RETURNING id`,[recipients,input.incidentId,input.kind,input.title,input.message,input.dedupeKey,input.requiredRole??null,input.excludedId??null]);
 return rows.length;
}
export async function notifyActiveViewers(client:SqlClient,input:Omit<Parameters<typeof notifyUsers>[2],'requiredRole'>){
 const {rows}=await client.query<{id:string}>("SELECT id FROM users WHERE role='VIEWER' AND NOT disabled");
 return notifyUsers(client,rows.map(row=>row.id),{...input,requiredRole:'VIEWER'});
}
export async function notifyActiveAdmins(client:SqlClient,input:Omit<Parameters<typeof notifyUsers>[2],'requiredRole'|'excludedId'>,excludedId?:string){
 const {rows}=await client.query<{id:string}>("SELECT id FROM users WHERE role='ADMIN' AND NOT disabled AND ($1::uuid IS NULL OR id<>$1::uuid)",[excludedId??null]);
 return notifyUsers(client,rows.map(row=>row.id),{...input,requiredRole:'ADMIN',excludedId});
}
export async function notifyActiveAnalyst(client:SqlClient,recipientId:string,input:Omit<Parameters<typeof notifyUsers>[2],'requiredRole'>){
 return notifyUsers(client,[recipientId],{...input,requiredRole:'ANALYST'});
}
