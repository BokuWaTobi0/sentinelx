import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { ExploreStory } from '@/components/explore/explore-story';
import '@/styles/public.css';
import '@/styles/dashboard.css';
import '@/styles/explore.css';

export default async function Explore() {
  const user = await requirePermission('alerts:read');
  return (
    <>
      <Header user={user} />
      <div className="ex-progress" aria-hidden="true" />
      <div className="app-content dx-page sx-scope">
        <div className="dx-glow" aria-hidden="true" />
        <header className="ex-hero">
          <p className="dx-eyebrow">How SentinelX works</p>
          <h1 className="dx-h1">From a <span className="sx-accent">login attempt</span> to a safe decision.</h1>
          <p className="dx-sub">No security background needed. Scroll slowly and each step appears in turn, with a plain-language picture of what is happening behind the screen.</p>
          <a className="ex-cue" href="#ex-step-1">Start scrolling <Icon name="arrow" size={15} /></a>
        </header>

        <ExploreStory />

        <section className="ex-end">
          <h2>That is the whole path.</h2>
          <p>Events become evidence, evidence becomes a ranked incident, people review it, and any response waits for a second person to approve. Everything here is simulated, so no real accounts, networks or devices are changed.</p>
          <div className="dx-actions">
            <Link className="sx-btn sx-btn--primary" href="/dashboard">See it with live data <span className="sx-btn__arrow"><Icon name="arrow" size={18} /></span></Link>
            <Link className="sx-btn sx-btn--ghost" href="/events">Browse the event stream</Link>
          </div>
        </section>

        <footer className="dx-footer"><p>SentinelX · Architecture · Local simulation, no real containment actions</p></footer>
      </div>
    </>
  );
}
