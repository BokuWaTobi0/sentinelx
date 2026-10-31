"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon,type IconName } from './icon';
import type {Role} from '@/lib/rbac';
export function Navigation({role}:{role:Role}){
 const admin=role==='ADMIN',canImport=role!=='VIEWER';
 const path=usePathname();
 const links:{href:string;label:string;icon:IconName}[]=[{href:'/dashboard',label:'Overview',icon:'grid'},{href:'/events',label:'Event stream',icon:'pulse'},...(canImport?[{href:'/import',label:'Import logs',icon:'activity' as const}]:[]),{href:'/explore',label:'Explore SentinelX',icon:'shield'},...(admin?[{href:'/admin/rules',label:'Detection rules',icon:'shield' as const},{href:'/admin',label:'Access & audit',icon:'lock' as const}]:[])];
 const isActive=(href:string)=>path===href||(href==='/dashboard'&&path.startsWith('/incidents/'))||(href==='/events'&&path.startsWith('/events/'));
 return <nav className="dx-nav" aria-label="Main navigation">{links.map(link=><Link key={link.href} href={link.href} className={isActive(link.href)?'dx-nav__item active':'dx-nav__item'} aria-current={isActive(link.href)?'page':undefined} aria-label={link.label} data-label={link.label}><Icon name={link.icon} size={20}/></Link>)}</nav>;
}
