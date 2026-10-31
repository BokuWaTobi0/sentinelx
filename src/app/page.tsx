import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Icon } from '@/components/icon';
import { SiteNav } from '@/components/site/site-nav';
import { HeroPreview } from '@/components/site/hero-preview';
import { ScrollReveal } from '@/components/site/scroll-reveal';
import '@/styles/public.css';
import '@/styles/site.css';

export const metadata: Metadata = {
  title: 'SentinelX — Security incidents, in focus',
  description: 'SentinelX brings incidents, evidence and analyst collaboration into one calm workspace.',
};

/** Add { href, label } entries here once privacy / terms pages exist. */
const legalLinks: { href: string; label: string }[] = [];

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const flow = [
  { icon: 'alert', title: 'Detected', text: 'Rules watch incoming activity and open an incident the moment a pattern appears.', state: 'New', tone: 'high' },
  { icon: 'search', title: 'Reviewed', text: 'Evidence and a priority explanation arrive with the incident, so review starts informed.', state: 'In review', tone: 'medium' },
  { icon: 'users', title: 'Actioned', text: 'An analyst assigns, escalates or requests a response. Approvals stay independent.', state: 'Escalated', tone: 'low' },
] as const;

const safeguards = [
  { icon: 'users', title: 'Role-based access', text: 'Viewer, Analyst and Admin permissions are enforced on the server.' },
  { icon: 'lock', title: 'Protected sessions', text: 'Sessions are short-lived and revocable, and tokens are stored only as hashes.' },
  { icon: 'shield', title: 'Sign-in safeguards', text: 'Repeated failed attempts are limited for each account.' },
  { icon: 'file', title: 'Evidence you can trust', text: 'Triggering evidence is immutable, and consequential actions are audited.' },
] as const;

export default function Home() {
  return (
    <div className="sx-scope sx-page">
      <a className="sx-skip" href="#content">Skip to content</a>
      <SiteNav />
      <ScrollReveal />

      <div id="content" tabIndex={-1}>
        {/* Hero */}
        <section className="sx-hero" aria-labelledby="hero-title">
          <div className="sx-container">
            <p className="sx-eyebrow" data-reveal>Incident management</p>
            <h1 id="hero-title" className="sx-hero__title">
              Security incidents,<br />brought <span className="sx-accent">into focus.</span>
            </h1>
            <p className="sx-hero__lead">
              SentinelX brings incidents, evidence and analyst collaboration into one workspace.
            </p>
            <div className="sx-hero__cta">
              <Link className="sx-btn sx-btn--primary sx-btn--lg" href="/dashboard" prefetch={false}>
                Open dashboard
                <span className="sx-btn__arrow"><Icon name="arrow" size={18} /></span>
              </Link>
              <a className="sx-btn sx-btn--ghost sx-btn--lg" href="#capabilities">Explore the platform</a>
            </div>
          </div>

          <div className="sx-container sx-container--wide sx-hero__preview">
            <HeroPreview />
            <p className="sx-sample-note">Sample incidents shown for illustration. No real data.</p>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="sx-section" aria-labelledby="cap-title">
          <div className="sx-container">
            <div className="sx-section__head" data-reveal>
              <p className="sx-eyebrow">Capabilities</p>
              <h2 id="cap-title" className="sx-h2">Everything an incident needs.<br />Nothing it doesn’t.</h2>
            </div>

            <div className="sx-caps">
              <article className="sx-cap" data-reveal style={delay(0)}>
                <div className="sx-cap__visual" aria-hidden="true">
                  <div className="sx-mini-row sx-mini-row--top"><i className="tone-high" /><span>Suspicious PowerShell execution</span><b className="sx-pill tone-high">High</b></div>
                  <div className="sx-mini-row"><i className="tone-medium" /><span>Multiple failed logins</span><b className="sx-pill tone-medium">Medium</b></div>
                  <div className="sx-mini-row"><i className="tone-low" /><span>Unusual data movement</span><b className="sx-pill tone-low">Low</b></div>
                </div>
                <h3>Incident prioritization</h3>
                <p>The incident that matters most rises to the top, with the reasons beside it.</p>
              </article>

              <article className="sx-cap" data-reveal style={delay(120)}>
                <div className="sx-cap__visual" aria-hidden="true">
                  <ol className="sx-mini-tl">
                    <li><i /><span><small>Detected</small>Rule matched</span></li>
                    <li><i /><span><small>Observed</small>Repeated failed attempts</span></li>
                    <li><i /><span><small>Linked</small>Same source address</span></li>
                    <li><i /><span><small>Attributed</small>Jordan Diaz</span></li>
                  </ol>
                </div>
                <h3>Evidence timelines</h3>
                <p>Every alert carries its evidence, in the order it happened.</p>
              </article>

              <article className="sx-cap" data-reveal style={delay(240)}>
                <div className="sx-cap__visual" aria-hidden="true">
                  <div className="sx-mini-assign"><span className="sx-avatar">MK</span><span><small>Assigned to</small>Morgan Kim</span><b className="sx-pill tone-medium">In review</b></div>
                  <div className="sx-mini-note"><span className="sx-avatar sx-avatar--alt">AT</span><p>Source address matches the earlier burst. Escalating for a closer look.</p></div>
                  <div className="sx-mini-handoff"><Icon name="users" size={15} />Handed to analyst</div>
                </div>
                <h3>Analyst collaboration</h3>
                <p>Assign, discuss and escalate without ever leaving the incident.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Product experience */}
        <section id="product" className="sx-section sx-section--product" aria-labelledby="product-title">
          <div className="sx-container">
            <div className="sx-section__head" data-reveal>
              <p className="sx-eyebrow">Product</p>
              <h2 id="product-title" className="sx-h2">From first signal<br />to confident decision.</h2>
            </div>

            <div className="sx-flow">
              <div className="sx-flow__track" aria-hidden="true"><span className="sx-flow__fill" data-reveal="line" /></div>
              <ol className="sx-flow__steps">
                {flow.map((step, i) => (
                  <li className="sx-flow__step" key={step.title} data-reveal style={delay(i * 140)}>
                    <span className="sx-flow__node" aria-hidden="true"><Icon name={step.icon} size={18} /></span>
                    <div className="sx-flow__body">
                      <span className={`sx-pill tone-${step.tone}`}><i aria-hidden="true" />{step.state}</span>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="sx-section" aria-labelledby="security-title">
          <div className="sx-container sx-security">
            <div className="sx-security__intro" data-reveal>
              <p className="sx-eyebrow">Security</p>
              <h2 id="security-title" className="sx-h2">Access you can<br />reason about.</h2>
              <p className="sx-lead">A workspace for sensitive work should be quiet about everything except what matters.</p>
            </div>
            <ul className="sx-security__list">
              {safeguards.map((item, i) => (
                <li key={item.title} data-reveal style={delay(i * 90)}>
                  <span className="sx-security__icon" aria-hidden="true"><Icon name={item.icon} size={18} /></span>
                  <div><h3>{item.title}</h3><p>{item.text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final call to action */}
        <section className="sx-cta" aria-labelledby="cta-title">
          <div className="sx-container" data-reveal>
            <h2 id="cta-title" className="sx-cta__title">See what needs<br />your <span className="sx-accent">attention.</span></h2>
            <div className="sx-hero__cta">
              <Link className="sx-btn sx-btn--primary sx-btn--lg" href="/dashboard" prefetch={false}>
                Open dashboard
                <span className="sx-btn__arrow"><Icon name="arrow" size={18} /></span>
              </Link>
              <Link className="sx-btn sx-btn--ghost sx-btn--lg" href="/login">Sign in</Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="sx-footer">
        <div className="sx-container">
          <div className="sx-footer__row">
            <Link className="brand" href="/" aria-label="SentinelX home">
              <span className="brand-mark"><Icon name="shield" size={19} /></span>
              Sentinel<span className="brand-x">X</span>
            </Link>
            <nav aria-label="Footer">
              <ul className="sx-footer__links">
                <li><a href="#product">Product</a></li>
                <li><a href="#capabilities">Capabilities</a></li>
                <li><a href="#security">Security</a></li>
                <li><Link href="/login">Sign in</Link></li>
                {legalLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}
              </ul>
            </nav>
          </div>
          <p className="sx-footer__note">
            Incidents, people and evidence shown on this page are sample data for illustration. SentinelX is currently a local demo and does not monitor real environments.
          </p>
          <p className="sx-footer__copy">© {new Date().getFullYear()} SentinelX</p>
        </div>
      </footer>
    </div>
  );
}
