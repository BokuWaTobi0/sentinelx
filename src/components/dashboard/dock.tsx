'use client';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/icon';

/** The single search input. Ctrl/Cmd+K focuses it from anywhere on the page. */
export function Dock({ query, carry }: { query: string; carry: Record<string, string> }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dx-dock">
      <form method="get" action="/dashboard#queue" role="search" className="dx-search">
        <Icon name="search" size={20} />
        <input
          ref={input}
          name="q"
          type="search"
          maxLength={200}
          defaultValue={query}
          placeholder="Search incidents, actors, or rules…"
          aria-label="Search incidents, actors, or rules"
          aria-keyshortcuts="Control+K Meta+K"
          autoComplete="off"
        />
        {Object.entries(carry).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <kbd aria-hidden="true">Ctrl K</kbd>
        <button type="submit" className="dx-round dx-round--lime" aria-label="Search"><Icon name="arrow" size={18} /></button>
      </form>
      <p className="dx-dock__caption">Your workspace. In focus.</p>
      <a className="dx-dock__link" href="#queue">Browse incident queue <Icon name="arrow" size={15} /></a>
    </div>
  );
}
