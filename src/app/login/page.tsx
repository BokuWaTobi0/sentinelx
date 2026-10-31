import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Icon } from '@/components/icon';
import { LoginForm } from '@/components/login-form';
import { Terrain } from '@/components/site/terrain';
import '@/styles/public.css';
import '@/styles/login.css';

export const metadata: Metadata = { title: 'Sign in — SentinelX', description: 'Sign in to your SentinelX workspace.' };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect('/dashboard');
  const { error } = await searchParams;
  return (
    <div className="sx-scope lx-layout">
      <div className="lx-form-side">
        <div className="lx-top">
          <Link className="brand" href="/" aria-label="SentinelX home">
            <span className="brand-mark"><Icon name="shield" size={21} /></span>
            Sentinel<span className="brand-x">X</span>
          </Link>
          <Link className="lx-back" href="/">
            <span className="lx-back__arrow"><Icon name="arrowLeft" size={16} /></span>
            Back to home
          </Link>
        </div>

        <div className="lx-form-wrap">
          <h1 className="lx-title">Welcome back</h1>
          <p className="lx-lead">Sign in to your SentinelX workspace.</p>
          <LoginForm error={error} />
          <p className="lx-assurance"><Icon name="lock" size={15} />Access is governed by your assigned role.</p>
        </div>

        <p className="lx-foot"><span className="lx-env"><i aria-hidden="true" />Local demo environment</span></p>
      </div>

      <aside className="lx-art" aria-hidden="true">
        <Terrain className="lx-art__terrain" />
        <div className="lx-art__copy">
          <p>Every signal.<br />A <span className="sx-accent">clearer picture.</span></p>
        </div>
      </aside>
    </div>
  );
}
