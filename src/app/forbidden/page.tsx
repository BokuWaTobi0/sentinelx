import Link from 'next/link';
import { Icon } from '@/components/icon';
export default function Forbidden(){return <div className="standalone"><div className="brand-mark"><Icon name="lock" size={26}/></div><p className="eyebrow">PERMISSION REQUIRED</p><h1>This area needs a different role.</h1><p className="page-description">Your account does not have permission to access this page or action.</p><Link className="button" href="/dashboard">Return to overview <Icon name="arrow"/></Link></div>;}
