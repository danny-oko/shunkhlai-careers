"use client";

import * as React from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Share of the remaining distance closed each frame. Lower drifts longer. */
const DAMPING = 0.11;
/** Close enough to the target to stop the loop and sit on it. */
const SETTLED = 0.0004;

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
 * pinned for.
 *
 * The number is eased toward the scroll position rather than snapped to it.
 * A wheel arrives in coarse steps, and anything driven straight off it moves
 * in the same steps; closing a share of the gap each frame turns those steps
 * into a glide, and the loop stops as soon as it has caught up.
 *
 * Under reduced motion it reports 1 and never listens to scroll, so the
 * caller can render the settled scene and drop the runway entirely.
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const isReduced = useReducedMotion();
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || isReduced) return;

    let frame = 0;
    let target = 0;
    let shown = 0;

    const step = () => {
      frame = 0;
      const gap = target - shown;

      if (Math.abs(gap) < SETTLED) {
        shown = target;
        setProgress(target);
        return;
      }

      shown += gap * DAMPING;
      setProgress(shown);
      schedule();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      const raw = runway <= 0 ? 1 : -rect.top / runway;
      target = Math.min(Math.max(raw, 0), 1);
      schedule();
    };

    // Covers a reload part-way down the page.
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [ref, isReduced]);

  return { progress: isReduced ? 1 : progress, isReduced };
}
