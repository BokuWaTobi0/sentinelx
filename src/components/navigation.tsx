"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon,type IconName } from './icon';
export function Navigation({admin}:{admin:boolean}){
 const path=usePathname();
 const links:{href:string;label:string;icon:IconName}[]=[{href:'/dashboard',label:'Overview',icon:'grid'},{href:'/events',label:'Event stream',icon:'pulse'},...(admin?[{href:'/admin',label:'Access & audit',icon:'lock' as const}]:[])];
 const isActive=(href:string)=>path===href||(href==='/dashboard'&&path.startsWith('/incidents/'))||(href==='/events'&&path.startsWith('/events/'));
 return <nav className="primary-nav" aria-label="Main navigation">{links.map(link=><Link key={link.href} href={link.href} className={isActive(link.href)?'nav-item active':'nav-item'} aria-current={isActive(link.href)?'page':undefined}><Icon name={link.icon}/><span>{link.label}</span>{isActive(link.href)&&<span className="nav-dot"/>}</Link>)}</nav>;
}
