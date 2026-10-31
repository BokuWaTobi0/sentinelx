"use client";
import { useEffect } from "react";

/**
 * Progressive-enhancement scroll reveal.
 * Elements marked [data-reveal] are visible by default (no-JS, reduced motion, already in view).
 * Only elements below the fold are hidden after hydration and eased in once as they enter the viewport.
 * Uses opacity + transform only. The data-rv attribute is removed afterwards so it never interferes with hover styles.
 */
export function ScrollReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!elements.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const timers = new Set<number>();
    const pending: HTMLElement[] = [];
    for (const el of elements) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue;
      el.dataset.rv = "pending";
      pending.push(el);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.dataset.rv = "in";
          const timer = window.setTimeout(() => {
            delete el.dataset.rv;
            timers.delete(timer);
          }, 2400);
          timers.add(timer);
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );
    pending.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      pending.forEach((el) => delete el.dataset.rv);
    };
  }, []);

  return null;
}
