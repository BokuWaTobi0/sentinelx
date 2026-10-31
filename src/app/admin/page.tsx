import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import '@/styles/public.css';
import '@/styles/workspace.css';
export default async function Admin(){
 const user=await requirePermission('audit:read');
 const [{rows:users},{rows:logs}]=await Promise.all([db.query('SELECT email,role,disabled FROM users ORDER BY email'),db.query('SELECT a.id,a.action,a.target_id,a.metadata,a.created_at,u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 50')]);
 return <><Header user={user}/><div className="app-content dx-page sx-scope wx-page">
 <header className="wx-head"><div><p className="dx-eyebrow">Governance</p><h1 className="wx-h1">Access &amp; audit</h1><p className="wx-sub">Know who has access. Trace what happened.</p></div><span className="wx-pill"><Icon name="lock" size={13}/>Admin</span></header>
 <section className="wx-surface" aria-label="Workspace members"><div className="wx-surface__head"><h2>Members</h2><span className="wx-count">{users.length}</span></div>
 <ul className="wx-list">{users.map(u=><li className="wx-row" key={u.email}><span className="wx-avatar" aria-hidden="true">{u.email.slice(0,1).toUpperCase()}</span><div className="wx-row__main"><strong>{u.email}</strong></div><span className="wx-tag wx-tag--mute">{u.role}</span><span className={u.disabled?'wx-state wx-state--off':'wx-state'}><i/>{u.disabled?'Disabled':'Enabled'}</span></li>)}</ul></section>
 <section className="wx-surface" aria-label="Audit trail"><div className="wx-surface__head"><h2>Audit trail</h2><p>Latest 50 actions · UTC</p></div>
 {!logs.length?<div className="wx-empty"><h3>No actions recorded yet</h3><p>Sign-ins, ingestion, and incident updates will appear here.</p></div>:<ul className="wx-list">{logs.map(log=><li className="wx-row" key={log.id}><span className="wx-icon" aria-hidden="true"><Icon name={log.action==='alert.detected'?'alert':log.action==='auth.login'?'lock':'pulse'} size={16}/></span><div className="wx-row__main"><strong>{log.action}</strong><span className="wx-meta">{log.email??'System / ingestion service'}{log.target_id&&<> · Target {log.target_id}</>}</span><details className="wx-details"><summary>Details</summary><pre>{JSON.stringify(log.metadata,null,2)}</pre></details></div><time>{new Date(log.created_at).toISOString().slice(0,19).replace('T',' ')}</time></li>)}</ul>}</section>
 </div></>;
}
