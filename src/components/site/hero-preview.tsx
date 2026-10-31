"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";

type Tone = "high" | "medium" | "low";
type Incident = {
  id: string;
  title: string;
  summary: string;
  tone: Tone;
  priority: string;
  icon: IconName;
  host: string;
  actor: string;
  age: string;
  evidence: { label: string; value: string; icon: IconName }[];
  risk: { level: number; label: string; note: string };
};

/* Sample data only. Addresses use documentation-reserved ranges (RFC 5737). */
const incidents: Incident[] = [
  {
    id: "powershell",
    title: "Suspicious PowerShell execution",
    summary: "Multiple indicators of attack · endpoint-23",
    tone: "high",
    priority: "High priority",
    icon: "terminal",
    host: "endpoint-23",
    actor: "Jordan Diaz",
    age: "12m ago",
    evidence: [
      { label: "Detection", value: "powershell-pattern-v1", icon: "lock" },
      { label: "Activity", value: "Encoded command run", icon: "file" },
      { label: "Source", value: "192.0.2.23", icon: "database" },
      { label: "Actor", value: "Jordan Diaz", icon: "monitor" },
    ],
    risk: { level: 5, label: "High", note: "Multiple indicators warrant a closer review." },
  },
  {
    id: "logins",
    title: "Multiple failed logins",
    summary: "Brute force pattern detected · vpn-gateway",
    tone: "medium",
    priority: "Medium priority",
    icon: "lock",
    host: "vpn-gateway",
    actor: "Morgan Kim",
    age: "34m ago",
    evidence: [
      { label: "Detection", value: "login-burst-v2", icon: "lock" },
      { label: "Activity", value: "12 failed attempts", icon: "file" },
      { label: "Source", value: "198.51.100.7", icon: "database" },
      { label: "Actor", value: "Morgan Kim", icon: "monitor" },
    ],
    risk: { level: 3, label: "Medium", note: "A repeated pattern, worth confirming with the account owner." },
  },
  {
    id: "transfer",
    title: "Unusual data movement",
    summary: "Outbound transfer above baseline · file-share-02",
    tone: "low",
    priority: "Low priority",
    icon: "database",
    host: "file-share-02",
    actor: "Alex Tan",
    age: "1h ago",
    evidence: [
      { label: "Detection", value: "egress-baseline-v1", icon: "lock" },
      { label: "Activity", value: "Large outbound transfer", icon: "file" },
      { label: "Source", value: "203.0.113.41", icon: "database" },
      { label: "Actor", value: "Alex Tan", icon: "monitor" },
    ],
    risk: { level: 2, label: "Low", note: "Likely routine, but the volume is unusual for this host." },
  },
];

export function HeroPreview() {
  const [active, setActive] = useState(0);
  const [assessed, setAssessed] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const finePointer = useRef(false);

  const count = incidents.length;
  const current = incidents[active];
  const peeks = [1, 2].map((offset) => ({ incident: incidents[(active + offset) % count], index: (active + offset) % count }));
  const isAssessed = !!assessed[current.id];
  const isSent = !!sent[current.id];

  // Pointer parallax is a mouse-only enhancement. It is skipped for touch and reduced motion.
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => { finePointer.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!finePointer.current || event.pointerType !== "mouse") return;
    const el = rootRef.current;
    if (!el) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const box = el.getBoundingClientRect();
      el.style.setProperty("--px", (((clientX - box.left) / box.width - 0.5) * 2).toFixed(3));
      el.style.setProperty("--py", (((clientY - box.top) / box.height - 0.5) * 2).toFixed(3));
    });
  };
  const onPointerLeave = () => {
    cancelAnimationFrame(frame.current);
    rootRef.current?.style.setProperty("--px", "0");
    rootRef.current?.style.setProperty("--py", "0");
  };

  const go = (index: number) => setActive(((index % count) + count) % count);
  const send = () => setSent((state) => ({ ...state, [current.id]: true }));

  return (
    <div
      className="sx-preview"
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="group"
      aria-label="Interactive preview of the SentinelX incident workspace, using sample data"
    >
      <div className="sx-preview__glow" aria-hidden="true" />
      <p className="sr-only" aria-live="polite">{`Showing incident ${active + 1} of ${count}: ${current.title}`}</p>

      <div className="sx-preview__stage">
        <div className="sx-stack">
          {/* Queued incidents peek out behind the focused one. */}
          {peeks.map(({ incident, index }, position) => (
            <div key={incident.id} className={`sx-peek sx-peek--${position + 1} sx-depth-${position + 2}`}>
              <button
                type="button"
                className={`sx-card sx-card--peek tone-${incident.tone}`}
                onClick={() => go(index)}
                aria-label={`Show incident: ${incident.title}, ${incident.priority}`}
              >
                <span className={`sx-tile sx-tile--sm tone-${incident.tone}`} aria-hidden="true"><Icon name={incident.icon} size={20} /></span>
                <span className={`sx-pill tone-${incident.tone}`}><i aria-hidden="true" />{incident.priority.replace(" priority", "")} priority</span>
                <span className="sx-peek__title">{incident.title}</span>
                <span className="sx-peek__summary">{incident.summary.split(" · ")[0]}</span>
                <span className="sx-peek__who"><Icon name="users" size={14} />{incident.actor}</span>
              </button>
            </div>
          ))}

          <div className="sx-front sx-depth-1">
            <article key={current.id} className={`sx-card sx-card--front tone-${current.tone}`} aria-label={current.title}>
              <div className="sx-card__top">
                <span className={`sx-tile tone-${current.tone}`} aria-hidden="true"><Icon name={current.icon} size={28} /></span>
                <span className={`sx-pill tone-${current.tone}`}><i aria-hidden="true" />{current.priority}</span>
                <div className="sx-pager">
                  <span aria-hidden="true">{active + 1} of {count}</span>
                  <button type="button" className="sx-round" onClick={() => go(active - 1)} aria-label="Previous incident"><Icon name="chevronLeft" size={16} /></button>
                  <button type="button" className="sx-round" onClick={() => go(active + 1)} aria-label="Next incident"><Icon name="chevronRight" size={16} /></button>
                </div>
              </div>

              <h3 className="sx-card__title">{current.title}</h3>
              <p className="sx-card__summary">{current.summary}</p>

              <dl className="sx-meta">
                <div><dt className="sr-only">Host</dt><dd><Icon name="monitor" size={16} />{current.host}</dd></div>
                <div><dt className="sr-only">Actor</dt><dd><Icon name="users" size={16} />{current.actor}</dd></div>
                <div><dt className="sr-only">Detected</dt><dd><Icon name="clock" size={16} />{current.age}</dd></div>
              </dl>

              <div className="sx-actions">
                <button type="button" className="sx-act sx-act--primary" onClick={() => setAssessed((s) => ({ ...s, [current.id]: true }))}>
                  <Icon name="search" size={18} />
                  <span>{isAssessed ? "Risk assessed" : "Assess risk"}</span>
                  <span className="sx-act__arrow"><Icon name={isAssessed ? "check" : "arrow"} size={17} /></span>
                </button>
                <button type="button" className="sx-act sx-act--secondary" onClick={send} aria-disabled={isSent}>
                  <Icon name="users" size={18} />
                  <span>{isSent ? "Escalated" : "Escalate to analyst"}</span>
                </button>
              </div>

              <div className="sx-card__foot">
                <span className="sx-status"><i aria-hidden="true" />{isSent ? "Escalated · awaiting analyst" : "Open"}</span>
                <span className="sx-simulated">Simulated signal</span>
              </div>
            </article>
          </div>
        </div>

        <aside className="sx-viewer sx-depth-0" aria-label="Incident viewer">
          <div className="sx-viewer__inner" key={current.id}>
            <p className="sx-viewer__label">Viewer</p>
            <div className="sx-viewer__head">
              <span className={`sx-tile sx-tile--sm tone-${current.tone}`} aria-hidden="true"><Icon name={current.icon} size={20} /></span>
              <div>
                <h3>{current.title}</h3>
                <p><i aria-hidden="true" />{isSent ? "Escalated" : "Open"} · Simulated</p>
              </div>
            </div>

            <div className="sx-viewer__section">
              <h4>Evidence</h4>
              <span>Snapshot</span>
            </div>
            <ol className="sx-evidence">
              {current.evidence.map((item, i) => (
                <li key={item.label} style={{ "--i": i } as React.CSSProperties}>
                  <span className="sx-evidence__icon" aria-hidden="true"><Icon name={item.icon} size={16} /></span>
                  <span><small>{item.label}</small><strong>{item.value}</strong></span>
                </li>
              ))}
            </ol>

            <div className="sx-viewer__section"><h4>Risk assessment</h4></div>
            <div className={`sx-risk tone-${current.tone}`} data-assessed={isAssessed}>
              <div className="sx-risk__meter" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} data-on={isAssessed && n <= current.risk.level} style={{ "--i": n } as React.CSSProperties} />
                ))}
              </div>
              <p>
                <strong>{isAssessed ? `${current.risk.label} risk` : "Not yet assessed"}</strong>
                <span>{isAssessed ? current.risk.note : "Choose Assess risk to review the indicators."}</span>
              </p>
            </div>

            <button type="button" className="sx-act sx-act--primary sx-act--block" onClick={send} aria-disabled={isSent}>
              <Icon name={isSent ? "check" : "send"} size={18} />
              <span>{isSent ? "Sent to analyst" : "Send to analyst"}</span>
              {!isSent && <span className="sx-act__arrow"><Icon name="arrow" size={17} /></span>}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
