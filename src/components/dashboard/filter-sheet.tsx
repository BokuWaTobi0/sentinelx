'use client';
import { useRef, type ReactNode } from 'react';
import { Icon } from '@/components/icon';

/** One "Filter" button that opens the incident filters in a native modal side sheet (focus trap + Esc included). */
export function FilterSheet({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="sx-btn sx-btn--ghost sx-btn--sm dx-filter-btn" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
        <Icon name="sliders" size={16} />Filter{activeCount > 0 && <span className="dx-count" aria-label={`${activeCount} active`}>{activeCount}</span>}
      </button>
      <dialog
        ref={dialog}
        className="dx-sheet"
        aria-labelledby="dx-sheet-title"
        onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
      >
        <div className="dx-sheet__head">
          <h2 id="dx-sheet-title">Filter incidents</h2>
          <button type="button" className="dx-round" onClick={() => dialog.current?.close()} aria-label="Close filters"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </dialog>
    </>
  );
}
