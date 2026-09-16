"use client";

import * as React from "react";

/**
 * How much of the article is left.
 *
 * Driven by scroll position rather than by an IntersectionObserver because the
 * value is continuous, and written straight to `transform` on a ref so a long
 * article does not re-render on every scroll frame. Sits directly under the
 * fixed site header.
 *
 * Purely decorative: `aria-hidden`, and a reader with motion turned down gets
 * the bar without the transition (see `globals.css`).
 */
export function ReadingProgress() {
  const bar = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = bar.current;
    if (!element) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      // A page shorter than the viewport has no progress to report; showing a
      // full bar there would say "finished" before anything was read.
      const ratio = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
      element.style.transform = `scaleX(${ratio})`;
    };

    const onScroll = () => {
      frame ||= window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-x-0 top-16 z-40 h-0.5 bg-transparent">
      {/* The collapsed start state is inline, on `transform`, because that is
          the property the effect writes. Tailwind's `scale-x-0` compiles to
          the separate `scale` property in v4, and the two multiply — a `scale`
          of zero pins the bar shut whatever `transform` says. */}
      <div
        ref={bar}
        className="news-progress h-full w-full"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
