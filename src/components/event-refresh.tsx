"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icon';
export function EventRefresh(){
 const router=useRouter();
 useEffect(()=>{
  const timer=setInterval(()=>{if(document.visibilityState==='visible') router.refresh();},5000);
  return ()=>clearInterval(timer);
 },[router]);
 return <button className="button secondary" type="button" onClick={()=>router.refresh()}><Icon name="refresh"/>Refresh events</button>;
}
