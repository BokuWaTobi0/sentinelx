"use client";
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Icon } from './icon';
export function RefreshButton(){const router=useRouter();const [pending,start]=useTransition();return <button className="button secondary" onClick={()=>start(()=>router.refresh())} disabled={pending}><Icon name="refresh"/>{pending?'Refreshing…':'Refresh'}</button>;}
