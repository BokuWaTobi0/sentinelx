"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

const links = [
  { href: "#product", label: "Product" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#security", label: "Security" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const media = window.matchMedia("(min-width: 820px)");
    const onMedia = () => media.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    media.addEventListener("change", onMedia);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      media.removeEventListener("change", onMedia);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="sx-nav" data-scrolled={scrolled} data-open={open} ref={rootRef}>
      <nav className="sx-nav__bar" aria-label="Primary">
        <Link className="brand" href="/" aria-label="SentinelX home">
          <span className="brand-mark"><Icon name="shield" size={19} /></span>
          Sentinel<span className="brand-x">X</span>
        </Link>

        <div className="sx-nav__panel" id="sx-nav-panel">
          <ul className="sx-nav__links">
            {links.map((link) => (
              <li key={link.href}>
                <a className="sx-nav__link" href={link.href} onClick={close}>{link.label}</a>
              </li>
            ))}
          </ul>
          <div className="sx-nav__actions">
            <Link className="sx-btn sx-btn--ghost sx-btn--sm" href="/login" onClick={close}>Sign in</Link>
            <Link className="sx-btn sx-btn--primary sx-btn--sm" href="/dashboard" prefetch={false} onClick={close}>
              Open dashboard
              <span className="sx-btn__arrow"><Icon name="arrow" size={16} /></span>
            </Link>
          </div>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="sx-nav__toggle"
          aria-expanded={open}
          aria-controls="sx-nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sx-nav__bars" aria-hidden="true"><span /><span /></span>
        </button>
      </nav>
    </header>
  );
}
