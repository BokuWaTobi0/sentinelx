import Link from 'next/link';
export default function NotFound(){return <div className="standalone"><p className="eyebrow">RECORD NOT FOUND</p><h1>This record is unavailable.</h1><p className="page-description">The link may be invalid or the record may no longer exist.</p><Link className="button" href="/dashboard">Return to overview</Link></div>;}
