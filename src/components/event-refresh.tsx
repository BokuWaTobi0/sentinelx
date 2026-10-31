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
 return <button className="sx-btn sx-btn--ghost sx-btn--sm" type="button" onClick={()=>router.refresh()}><Icon name="refresh" size={15}/>Refresh</button>;
}
