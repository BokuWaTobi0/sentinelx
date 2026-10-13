import { logout } from '@/app/auth-actions';
import type { User } from '@/lib/auth';
import { automationProvider } from '@/lib/automation-provider';
import { Navigation } from './navigation';
import { Icon } from './icon';
export function Header({user}:{user:User}){
 const provider=automationProvider();const providerLabel=provider==='local'?'Local automation':'Windmill automation';
 return <><aside className="sidebar"><a className="brand" href="/dashboard"><span className="brand-mark"><Icon name="shield" size={23}/></span>Sentinel<span className="brand-x">X</span></a><div className="workspace-label"><span className="workspace-icon">S</span><div>Local workspace<small>Security operations</small></div><span className="workspace-dot"/></div><p className="nav-caption">WORKSPACE</p><Navigation admin={user.role==='ADMIN'}/><div className="sidebar-bottom"><div className="demo-notice"><Icon name="shield"/><div>{providerLabel}<small>Investigation and response demos</small></div></div><div className="sidebar-user"><span className="avatar">{user.name.slice(0,1)}</span><div><strong>{user.name}</strong><small>{user.role.toLowerCase()}</small></div><form action={logout}><button className="icon-button" aria-label="Sign out" title="Sign out"><Icon name="logout"/></button></form></div></div></aside><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Security operations</strong></div><div className="topbar-right"><span className="environment"><span/>{providerLabel}</span><span className="topbar-role">{user.role.toLowerCase()}</span></div></header></>;
}
