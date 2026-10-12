'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div className="standalone"><p className="eyebrow">WORKSPACE UNAVAILABLE</p><h1>We couldn’t load this page.</h1><p>The server could not complete the request. Check that PostgreSQL is running, then try again. If this continues, inspect the server terminal.</p><div className="recovery-actions"><button className="button" onClick={reset}>Try again</button><Link className="button secondary" href="/login">Return to sign in</Link></div></div>;
}
