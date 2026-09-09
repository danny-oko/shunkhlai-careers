"use client";

import * as React from "react";

/** Pixels of scroll per second that reads as one km/h on the gauge. */
const PX_PER_KMH = 26;
/** How fast the needle falls back once scrolling stops. */
const DECAY_PER_SECOND = 3.2;
const MAX_KMH = 90;

/**
 * A speed readout driven by how fast the page is being scrolled.
 *
 * Distance travelled since the last frame becomes a km/h figure, smoothed on
 * the way up and eased back to zero when the reader stops — so the number
 * behaves like a speedometer rather than flickering with every wheel tick.
 */
export function useScrollSpeed(active: boolean) {
  const [kmh, setKmh] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;

    let frame = 0;
    let lastY = window.scrollY;
    let lastAt = performance.now();
    let current = 0;

    const tick = (now: number) => {
      const seconds = Math.max((now - lastAt) / 1000, 0.001);
      const y = window.scrollY;
      const target = Math.min(Math.abs(y - lastY) / seconds / PX_PER_KMH, MAX_KMH);

      // Rise quickly, fall away slowly.
      const blend = target > current ? 0.35 : Math.min(DECAY_PER_SECOND * seconds, 1);
      current += (target - current) * blend;

      lastY = y;
      lastAt = now;
      setKmh(Math.round(current));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  // Reads zero whenever the gauge is off, without writing state to say so.
  return active ? kmh : 0;
}
