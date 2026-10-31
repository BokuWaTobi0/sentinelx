import '@/styles/public.css';
import '@/styles/dashboard.css';

export default function Loading() {
  return (
    <div className="app-content dx-page sx-scope" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div className="dx-glow" aria-hidden="true" />
      <div className="dx-first">
        <header className="dx-hero">
          <span className="dx-skel" style={{ width: 160, height: 28 }} />
          <span className="dx-skel" style={{ width: 'min(560px, 90%)', height: 64, marginTop: 14 }} />
          <span className="dx-skel" style={{ width: 'min(440px, 80%)', height: 18, marginTop: 20 }} />
        </header>
        <div className="dx-stage">
          <span className="dx-skel dx-skel--card" />
          <span className="dx-skel dx-skel--card" />
        </div>
      </div>
      <span className="dx-sr">Loading incidents…</span>
    </div>
  );
}
