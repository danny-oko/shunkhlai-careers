"use client";

import * as React from "react";

const DURATION_MS = 1400;

/**
 * Counts up to `value` the first time it scrolls into view.
 *
 * The final number is rendered on the server too, so the figure is correct
 * with JavaScript disabled and for anyone who has asked for reduced motion.
 */
export function StatCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = React.useState(value);

  React.useEffect(() => {
    const element = ref.current;
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!element || prefersReduced || typeof IntersectionObserver === "undefined") {
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          // easeOutExpo — fast off the mark, settles gently on the figure.
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setShown(Math.round(eased * value));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };

        setShown(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}
