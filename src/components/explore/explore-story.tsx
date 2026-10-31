'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const i = (n: number) => ({ '--i': n }) as CSSProperties;

/** Small illustrations. Sample values are examples, not live data. */
function Chip({ tone, children, n }: { tone?: 'red' | 'lime' | 'amber'; children: ReactNode; n: number }) {
  return <span className={`ex-chip ex-pop${tone ? ` is-${tone}` : ''}`} style={i(n)}>{children}</span>;
}

const visuals: Record<string, () => ReactNode> = {
  events: () => (
    <div className="ex-card ex-log">
      <p className="dx-eyebrow ex-pop" style={i(0)}>Example event log</p>
      {[
        ['Login failed', 'alex', '203.0.113.7', 'red'],
        ['Login failed', 'alex', '203.0.113.7', 'red'],
        ['Login failed', 'alex', '203.0.113.7', 'red'],
        ['Login succeeded', 'alex', '203.0.113.7', 'lime'],
      ].map(([what, who, where, tone], n) => (
        <div className="ex-row ex-pop" style={i(n + 1)} key={n}>
          <span className={`ex-dot is-${tone}`} /><strong>{what}</strong><span>{who}</span><span className="ex-mono">{where}</span>
        </div>
      ))}
    </div>
  ),
  intake: () => (
    <div className="ex-card ex-intake">
      <Chip n={0}>New event</Chip>
      <span className="ex-arrow ex-pop" style={i(1)} aria-hidden="true">↓</span>
      <div className="ex-gate ex-pop" style={i(2)}>
        <p>Checked on arrival</p>
        <ul><li>Right format?</li><li>Seen before?</li><li>Saved once</li></ul>
      </div>
      <span className="ex-arrow ex-pop" style={i(3)} aria-hidden="true">↓</span>
      <Chip n={4} tone="lime">Stored in the database</Chip>
      <Chip n={5} tone="amber">Duplicate: ignored</Chip>
    </div>
  ),
  rules: () => (
    <div className="ex-card ex-rules">
      <p className="dx-eyebrow ex-pop" style={i(0)}>Within a few minutes</p>
      <div className="ex-pulse">
        {['red', 'red', 'red', 'red', 'red', 'lime'].map((tone, n) => <span key={n} className={`ex-dot is-${tone} ex-pop`} style={i(n + 1)} />)}
      </div>
      <p className="ex-caption ex-pop" style={i(7)}>5 failures, then a success</p>
      <ul className="ex-rulelist">
        {['Burst of failed logins', 'Password spraying', 'Repeated failures from one source', 'Success after failures'].map((rule, n) => (
          <li key={rule} className={`ex-pop${n === 3 ? ' is-hit' : ''}`} style={i(n + 8)}>{rule}</li>
        ))}
      </ul>
    </div>
  ),
  incident: () => (
    <div className="ex-card ex-incident">
      <span className="ex-chip is-red ex-pop" style={i(0)}>Incident opened</span>
      <h4 className="ex-pop" style={i(1)}>Suspicious successful login after failures</h4>
      <dl>
        <div className="ex-pop" style={i(2)}><dt>Rule</dt><dd>Success after failures</dd></div>
        <div className="ex-pop" style={i(3)}><dt>Evidence</dt><dd>4 events, saved by ID</dd></div>
        <div className="ex-pop" style={i(4)}><dt>Status</dt><dd>Open</dd></div>
      </dl>
      <p className="ex-lock ex-pop" style={i(5)}>Evidence is frozen. New events never rewrite it.</p>
    </div>
  ),
  priority: () => (
    <div className="ex-card ex-priority">
      <p className="dx-eyebrow ex-pop" style={i(0)}>Priority</p>
      <div className="ex-scale ex-pop" style={i(1)}>
        {['Low', 'Medium', 'High', 'Critical'].map((band, n) => <span key={band} className={n < 2 ? 'is-on' : ''}>{band}</span>)}
      </div>
      <ul className="ex-why">
        <li className="ex-pop" style={i(2)}><b>+25</b> Success after a failure burst</li>
        <li className="ex-pop" style={i(3)}><b>+20</b> Volume of failures</li>
        <li className="ex-pop" style={i(4)}><b>+5</b> Other context</li>
      </ul>
      <p className="ex-toast ex-pop" style={i(5)}>An Analyst is notified</p>
    </div>
  ),
  people: () => (
    <div className="ex-card ex-people">
      {[
        ['Viewer', ['Reads incidents and events', 'Escalates to an Analyst']],
        ['Analyst', ['Takes ownership', 'Adds notes, updates status']],
        ['Admin', ['Edits detection rules', 'Approves simulated responses']],
      ].map(([role, items], n) => (
        <div className="ex-role ex-pop" style={i(n)} key={role as string}>
          <strong>{role as string}</strong>
          <ul>{(items as string[]).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      ))}
    </div>
  ),
  automation: () => (
    <div className="ex-card ex-auto">
      <Chip n={0}>Investigation report</Chip>
      <span className="ex-arrow ex-pop" style={i(1)} aria-hidden="true">↓</span>
      <Chip n={2} tone="amber">Waits in a safe queue</Chip>
      <span className="ex-arrow ex-pop" style={i(3)} aria-hidden="true">↓</span>
      <div className="ex-gate is-human ex-pop" style={i(4)}><p>A different Admin must approve</p></div>
      <span className="ex-arrow ex-pop" style={i(5)} aria-hidden="true">↓</span>
      <Chip n={6} tone="lime">Simulated action only</Chip>
    </div>
  ),
};

const steps = [
  {
    id: 'events', visual: 'events', kicker: 'Step 1 · Something happens', title: 'Every sign-in leaves a small record',
    plain: 'Think of a logbook at a building entrance. Each time someone tries to get in, a line is written: who, from where, and whether it worked.',
    does: 'SentinelX calls each line an event. Events come from your systems, or from the simulator and file import in this demo.',
  },
  {
    id: 'intake', visual: 'intake', kicker: 'Step 2 · Events arrive', title: 'Each event is checked, then saved once',
    plain: 'Like a receptionist who checks a form is filled in properly and never files the same page twice.',
    does: 'Events are validated and stored in PostgreSQL. If the same event is sent again, it is ignored, so nothing is double counted.',
  },
  {
    id: 'rules', visual: 'rules', kicker: 'Step 3 · Spotting patterns', title: 'Simple, explainable rules watch for trouble',
    plain: 'One failed password is normal. Five in a minute, followed by a success, deserves a second look.',
    does: 'Four fixed rules look for failed-login bursts, password spraying, repeated failures from one source, and success after failures. A match means “worth checking”, not “proven attack”.',
  },
  {
    id: 'incident', visual: 'incident', kicker: 'Step 4 · An incident is opened', title: 'The evidence is saved and frozen',
    plain: 'Like putting the relevant pages from the logbook into a sealed folder, so nobody can quietly change them later.',
    does: 'An incident records which rule matched and the exact event IDs behind it. Events that arrive later appear as context, but never alter the original evidence.',
  },
  {
    id: 'priority', visual: 'priority', kicker: 'Step 5 · What to look at first', title: 'A priority score puts the urgent ones on top',
    plain: 'Like a hospital triage desk: not every case is equally urgent, and the reason is written down.',
    does: 'Each incident gets a priority from Low to Critical, with the reasons listed point by point. The right people are notified inside the app.',
  },
  {
    id: 'people', visual: 'people', kicker: 'Step 6 · People take over', title: 'Humans review, and each role has limits',
    plain: 'A Viewer can raise a hand, an Analyst investigates, and an Admin controls the rules and approvals.',
    does: 'Roles are enforced on the server, not just hidden in the interface. Every assignment, note and status change is recorded in the history.',
  },
  {
    id: 'automation', visual: 'automation', kicker: 'Step 7 · Safe automation', title: 'Machines prepare, a human decides',
    plain: 'A helper can gather facts overnight, but it cannot press the big red button without a manager’s signature.',
    does: 'Investigation reports run through a durable queue that survives restarts. Containment only happens after another Admin approves, and here it is simulated: no real account, network or device is touched.',
  },
];

export function ExploreStory() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-ex-step]'));
    setReady(true);
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-in'));
    }

    const reveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        reveal.unobserve(entry.target);
      }
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    const track = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.exStep));
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    nodes.forEach((n) => { if (!n.classList.contains('is-in')) reveal.observe(n); track.observe(n); });

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - rect.top) / Math.max(1, rect.height)));
        document.documentElement.style.setProperty('--ex-p', progress.toFixed(4));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      reveal.disconnect();
      track.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.documentElement.style.removeProperty('--ex-p');
    };
  }, []);

  return (
    <div ref={root} className={`ex-story${ready ? ' ex-js' : ''}`} aria-label="How SentinelX works, step by step">
      <div className="ex-stage" aria-hidden="true">
        <div className="ex-stage__inner">
          <div className="ex-stage__meta">
            <span className="ex-count">{String(active + 1).padStart(2, '0')}<small> / {String(steps.length).padStart(2, '0')}</small></span>
            <span className="ex-bar"><i style={{ transform: `scaleX(${(active + 1) / steps.length})` }} /></span>
          </div>
          <div className="ex-stage__views">
            {steps.map((step, n) => (
              <div key={step.id} className={`ex-vis${n === active ? ' is-active' : ''}`}>{visuals[step.visual]()}</div>
            ))}
          </div>
        </div>
      </div>

      <ol className="ex-steps">
        {steps.map((step, n) => (
          <li key={step.id} id={`ex-step-${n + 1}`} data-ex-step={n} className={`ex-step${n === active ? ' is-active' : ''}`}>
            <p className="ex-kicker" data-ex style={i(0)}>{step.kicker}</p>
            <h3 data-ex style={i(1)}>{step.title}</h3>
            <p className="ex-plain" data-ex style={i(2)}><span>In plain words</span>{step.plain}</p>
            <p className="ex-does" data-ex style={i(3)}><span>What SentinelX does</span>{step.does}</p>
            <div className="ex-inline" aria-hidden="true" data-ex style={i(4)}>{visuals[step.visual]()}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
