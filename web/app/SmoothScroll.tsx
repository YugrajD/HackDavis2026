"use client";

import { useEffect } from "react";

// Inertial smooth-scroll. Listens to wheel + touch events, accumulates a
// target offset, then lerps document scroll toward it on each animation
// frame. Dropped in once at the layout level; no React state, no deps.
//
// Tuned to feel like Augen Pro / Lenis defaults: slightly heavy, ease-out,
// preserves the browser's history scroll-restoration. Skipped when the user
// has prefers-reduced-motion enabled.
export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ("ontouchstart" in window && navigator.maxTouchPoints > 1) {
      // Native momentum scroll on touch devices already feels right.
      return;
    }

    let target = window.scrollY;
    let current = window.scrollY;
    let raf = 0;
    let active = false;

    const ease = 0.09; // lower = smoother & heavier
    const maxDelta = 600;

    const max = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const tick = () => {
      const next = current + (target - current) * ease;
      // Snap when within sub-pixel; avoids endless RAF.
      if (Math.abs(next - target) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        active = false;
        raf = 0;
        return;
      }
      current = next;
      window.scrollTo(0, current);
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      // Let pinch-zoom + ctrl-wheel through.
      if (e.ctrlKey) return;
      e.preventDefault();
      const delta = Math.max(-maxDelta, Math.min(maxDelta, e.deltaY));
      target = Math.max(0, Math.min(max(), target + delta));
      if (!active) {
        active = true;
        raf = requestAnimationFrame(tick);
      }
    };

    // Sync target on programmatic scrolls so anchor links work.
    const onScroll = () => {
      if (!active) {
        target = window.scrollY;
        current = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
