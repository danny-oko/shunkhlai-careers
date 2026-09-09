"use client";

import * as React from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the visitor has asked for reduced motion, kept in sync if they
 * change the setting while the page is open. Assumes full motion on the
 * server, which is what the markup is rendered for.
 */
export function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * How far a tall element has been scrolled through, from 0 to 1.
 *
 * 0 while its top edge is still at or below the top of the viewport, 1 once
 * its bottom edge reaches the bottom — i.e. the runway a `sticky` child is
 * pinned for. Reads are batched into one animation frame per scroll burst so
 * the listener never lays out more than once a frame.
 *
 * Under reduced motion it reports 1 and never listens to scroll, so the
 * caller can render the settled scene and drop the runway entirely.
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const isReduced = useReducedMotion();
  const [scrolled, setScrolled] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || isReduced) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      const raw = runway <= 0 ? 1 : -rect.top / runway;
      setScrolled(Math.min(Math.max(raw, 0), 1));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    // Covers a reload part-way down the page.
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, isReduced]);

  return { progress: isReduced ? 1 : scrolled, isReduced };
}
