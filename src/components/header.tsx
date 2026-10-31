import { logout } from '@/app/auth-actions';
import type { User } from '@/lib/auth';
import { automationProvider } from '@/lib/automation-provider';
import { Navigation } from './navigation';
import { Icon } from './icon';
import {NotificationCenter} from './notification-center';
import {db} from '@/lib/db';
import '@/styles/dashboard.css';
export async function Header({user}:{user:User}){
 const provider=automationProvider();const providerLabel=provider==='local'?'Local automation':'Windmill automation';
 const {rows:[row]}=await db.query<{count:number}>('SELECT count(*)::int AS count FROM notifications WHERE recipient_id=$1 AND read_at IS NULL',[user.id]);
 return <><aside className="dx-rail"><a className="dx-rail__brand" href="/dashboard" aria-label="SentinelX overview"><Icon name="shield" size={22}/></a><Navigation role={user.role}/><div className="dx-rail__bottom"><span className="dx-avatar" role="img" aria-label={`${user.name}, ${user.role.toLowerCase()}`} data-label={`${user.name} · ${user.role.toLowerCase()}`}>{user.name.slice(0,1)}</span><form action={logout}><button className="dx-rail__btn" aria-label="Sign out" data-label="Sign out"><Icon name="logout" size={20}/></button></form></div></aside><header className="dx-topbar"><span className="dx-crumb">Security operations</span><div className="dx-topbar__right"><NotificationCenter initialUnread={row.count}/><span className="dx-chip"><i/>{providerLabel}</span><span className="dx-chip dx-chip--role">{user.role.toLowerCase()}</span></div></header></>;
}
