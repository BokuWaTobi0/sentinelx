'use client';
import { useEffect, useRef, useState } from 'react';

const steps = [
  { id: 'ingestion', title: 'Event ingestion', kind: 'Incoming activity', copy: 'Login activity is checked against the event schema, stored idempotently, and evaluated with the detection rules in the same transaction.', detail: 'Repeated delivery does not create duplicate events or incidents.' },
  { id: 'detection', title: 'Detection rules', kind: 'Suspicious patterns', copy: 'Deterministic rules look for failed-login bursts, password spraying, repeated source-IP failures, and a successful login after a recent burst.', detail: 'A match is a suspicious pattern to investigate, not proof of an attack.' },
  { id: 'evidence', title: 'Incident evidence', kind: 'Immutable snapshot', copy: 'Each incident records the matched rule and the exact event IDs that triggered it. Later related events are shown separately as context.', detail: 'The original triggering evidence does not change when new events arrive.' },
  { id: 'queue', title: 'Durable automation queue', kind: 'Background work', copy: 'Investigation jobs are stored in the database. Workers claim them with leases, retry failures, prevent duplicates, and record atomic completion receipts.', detail: 'Queued work can recover after a worker stops or restarts.' },
  { id: 'approval', title: 'Independent Admin approval', kind: 'Human decision', copy: 'Investigation reports run automatically. Simulated containment is queued only after a separate active Admin approves another user’s request.', detail: 'The requester cannot approve their own request. Analysts and assignment do not bypass approval.' },
  { id: 'execution', title: 'Local or Windmill execution', kind: 'Simulation only', copy: 'Local automation is the default. Windmill remains available when explicitly selected. Both providers produce recorded investigation results.', detail: 'Containment is simulated. SentinelX never changes real accounts, networks, or devices.' },
];

export function ArchitectureExplorer() {
  const listRef = useRef<HTMLOListElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-architecture-step]'));
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      setVisibleCount(items.length);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        setVisibleCount((count) => Math.min(steps.length, Math.max(count, Number((entry.target as HTMLElement).dataset.step) + 1)));
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <div className="architecture-scroll" aria-label="SentinelX architecture, revealed step by step">
    <div className="architecture-progress" role="status" aria-live="polite">
      <span>Architecture path</span><strong>{Math.max(visibleCount, 1)} / {steps.length} steps revealed</strong>
      <div className="architecture-progress-track" aria-hidden="true"><span style={{ width: `${(visibleCount / steps.length) * 100}%` }} /></div>
    </div>
    <ol className="architecture-steps" ref={listRef}>
      {steps.map((step, index) => <li className="architecture-step" data-architecture-step data-step={index} key={step.id}>
        <div className="architecture-step-marker" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></div>
        <article className="architecture-step-card">
          <p className="eyebrow">{step.kind}</p><h2>{step.title}</h2><p className="architecture-step-copy">{step.copy}</p>
          <p className="architecture-step-detail">{step.detail}</p>
          {index < steps.length - 1 && <p className="architecture-next">Leads to <strong>{steps[index + 1].title}</strong><span aria-hidden="true"> ↓</span></p>}
        </article>
      </li>)}
    </ol>
    <p className="architecture-end-note">That is the complete SentinelX path: events become evidence, investigations run through a durable queue, and simulated containment waits for independent Admin approval.</p>
  </div>;
}
