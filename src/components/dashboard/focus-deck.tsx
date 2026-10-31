'use client';
import Link from 'next/link';
import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import type { Role } from '@/lib/rbac';
import { Meter } from './meter';
import { statusLabel, type FocusIncident } from './view';

type Props = {
  incidents: FocusIncident[];
  controls: (ReactNode | null)[];
  role: Role;
  total: number;
};

/** Where the secondary and "send" actions go for each role. The forms themselves live on the incident page. */
function handoff(role: Role, id: string) {
  if (role === 'VIEWER') return { href: `/incidents/${id}#escalate`, secondary: 'Escalate to analyst', send: 'Send to analyst' };
  if (role === 'ADMIN') return { href: `/incidents/${id}#request-investigation`, secondary: 'Request investigation', send: 'Send to analyst' };
  return { href: `/incidents/${id}`, secondary: null, send: 'Open investigation' };
}

export function FocusDeck({ incidents, controls, role, total }: Props) {
  const [selected, setSelected] = useState(incidents[0]?.id);
  const found = incidents.findIndex((item) => item.id === selected);
  const active = found === -1 ? 0 : found;
  const current = incidents[active];
  const go = (index: number) => setSelected(incidents[Math.min(incidents.length - 1, Math.max(0, index))].id);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(active + 1); }
  }

  const action = handoff(role, current.id);

  return (
    <div className="dx-stage" onKeyDown={onKeyDown}>
      <section className="dx-deck" aria-roledescription="carousel" aria-label="Incidents that need review">
        <p className="dx-sr" aria-live="polite" aria-atomic="true">
          Showing incident {active + 1} of {incidents.length}: {current.title}
        </p>
        <div className="dx-stack">
          {incidents.map((item, index) => {
            const rel = index - active;
            const state = rel === 0 ? 'active' : rel > 0 ? 'behind' : 'past';
            const peeking = state === 'behind' && rel <= 2;
            const card = handoff(role, item.id);
            return (
              <article
                key={item.id}
                className={`dx-card tone-${item.tone}`}
                data-state={state}
                style={{ '--o': Math.max(0, rel) } as CSSProperties}
                inert={state === 'past' || rel > 2}
              >
                <div className="dx-card__inner" inert={state !== 'active'}>
                  <header className="dx-card__top">
                    <span className="dx-tile" aria-hidden="true"><Icon name="alert" size={26} /></span>
                    <span className="sx-pill dx-pill"><i />{item.priorityLabel}</span>
                    <div className="dx-pager" role="group" aria-label="Choose incident">
                      <span className="dx-pager__count">{index + 1} of {incidents.length}</span>
                      <button type="button" className="dx-round" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous incident"><Icon name="chevronLeft" size={18} /></button>
                      <button type="button" className="dx-round" onClick={() => go(active + 1)} disabled={active === incidents.length - 1} aria-label="Next incident"><Icon name="chevronRight" size={18} /></button>
                    </div>
                  </header>
                  <h2 className="dx-card__title">{item.title}</h2>
                  <p className="dx-card__sub">{item.subtitle}</p>
                  <dl className="dx-meta">
                    <div><dt>Source</dt><dd><Icon name="monitor" size={16} />{item.source ?? 'Not recorded'}</dd></div>
                    <div><dt>Actor</dt><dd><Icon name="user" size={16} />{item.actor ?? 'Not recorded'}</dd></div>
                    <div><dt>Detected</dt><dd><Icon name="clock" size={16} /><time dateTime={item.iso}>{item.ago}</time></dd></div>
                  </dl>
                  <div className="dx-actions">
                    <Link href={`/incidents/${item.id}`} className="sx-btn sx-btn--primary">Assess risk <span className="sx-btn__arrow"><Icon name="arrow" size={18} /></span></Link>
                    {card.secondary && <Link href={card.href} className="sx-btn sx-btn--ghost">{card.secondary}</Link>}
                  </div>
                  <p className="dx-card__foot">
                    <span className={`dx-status s-${item.status.toLowerCase()}`}><i />{item.statusLabel}</span>
                    <span className="dx-eyebrow">{item.signal}</span>
                  </p>
                </div>
                {peeking && (
                  <button type="button" className="dx-card__pick" onClick={() => setSelected(item.id)} aria-label={`Show incident ${index + 1} of ${incidents.length}: ${item.title}`} />
                )}
              </article>
            );
          })}
        </div>
        {total > incidents.length && <p className="dx-note">Showing the top {incidents.length} by priority. {total} need review in total.</p>}
      </section>

      <aside className="dx-viewer" aria-label="Incident viewer">
        <div key={current.id} className="dx-fade">
          <p className="dx-eyebrow">Viewer</p>
          <h3 className="dx-viewer__title">{current.title}</h3>
          <p className="dx-viewer__status">{current.statusLabel} · {current.signal === 'Simulated signal' ? 'Simulated' : current.signal}</p>
          {controls[active] && <div className="dx-viewer__controls">{controls[active]}</div>}

          <div className="dx-evidence">
            <h4>Evidence</h4>
            <span className="dx-eyebrow">Snapshot</span>
          </div>
          <ol className="dx-timeline">
            <li className="tone-high"><i /><div><span className="dx-eyebrow">Detection</span><p>{current.rule}</p></div></li>
            <li className="tone-medium"><i /><div><span className="dx-eyebrow">Activity</span><p>{current.activity ?? 'No activity detail recorded'}</p></div></li>
            <li className="tone-medium"><i /><div><span className="dx-eyebrow">Source</span><p>{current.source ?? 'Not recorded'}</p></div></li>
            <li className="tone-lime"><i /><div><span className="dx-eyebrow">Actor</span><p>{current.actor ?? 'Not recorded'}</p></div></li>
          </ol>

          <div className={`dx-risk tone-${current.tone}`}>
            <div className="dx-risk__head">
              <p className="dx-eyebrow">Risk assessment</p>
              <Meter score={current.score} band={current.band} tone={current.tone} />
            </div>
            <strong>{current.band ? statusLabel(current.band) : 'Unscored'}</strong>
            <p>{current.riskText}</p>
          </div>

          <Link href={action.href} className="sx-btn sx-btn--primary dx-block">{action.send} <span className="sx-btn__arrow"><Icon name="arrow" size={18} /></span></Link>
        </div>
      </aside>
    </div>
  );
}
