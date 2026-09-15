"use client";

import * as React from "react";

/** What counts as something you can press, for the ring to open over. */
const PRESSABLE =
  'a[href], button:not(:disabled), [role="button"], summary, label[for], select, input:not([type="hidden"]), textarea, [data-rail-stop]';

/** Where the caret belongs to the field, not to us. */
const TYPING = "input, textarea, [contenteditable]";

/** Share of the remaining distance the ring closes each frame. */
const EASE = 0.18;

/**
 * A point of light and a turning ring, in place of the arrow.
 *
 * The light is exactly where the pointer is - a small brand-coloured core
 * carrying a soft halo, so it reads as something lit rather than as a drawn
 * dot. The ring of dashes chases it a frame behind, which is what makes it
 * read as trailing the hand rather than being painted on it, and turns slowly
 * on its own. Over anything pressable the ring opens out and takes the brand
 * colour, so the thing the arrow's hand used to say is still said.
 *
 * Everything is written straight to the two elements' styles inside one
 * animation frame. Through React state this would be a render per pointer
 * move, and the pointer moves more often than the screen refreshes.
 *
 * It puts itself in only where there is a real pointer and motion is wanted:
 * on a touch screen there is nothing to follow, and the native cursor is only
 * taken away once this is running, so a page with no JavaScript keeps it.
 */
export function CursorRing() {
  const ringRef = React.useRef<HTMLDivElement>(null);
  const dotRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    document.documentElement.dataset.cursorRing = "on";

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let frame = 0;
    let seen = false;

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;

      if (!seen) {
        // Land the ring on the first sighting rather than flying it in from
        // the middle of the screen.
        seen = true;
        rx = x;
        ry = y;
        ring.dataset.seen = "yes";
        dot.dataset.seen = "yes";
      }

      const over = event.target as Element | null;
      ring.dataset.over = over?.closest?.(PRESSABLE) ? "yes" : "no";
      // Over a field the caret is the thing that matters, so the field keeps
      // its own cursor and the ring steps back out of the way.
      dot.dataset.over = over?.closest?.(TYPING) ? "typing" : "no";
    };

    const onLeave = () => {
      ring.dataset.seen = "no";
      dot.dataset.seen = "no";
      seen = false;
    };

    const draw = () => {
      rx += (x - rx) * EASE;
      ry += (y - ry) * EASE;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) translate(-50%, -50%)`;
      dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      frame = requestAnimationFrame(draw);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      delete document.documentElement.dataset.cursorRing;
    };
  }, []);

  // Both marks are always in the page, and start invisible: they are only
  // lit once the pointer has been seen, and on a touch screen it never is.
  //
  // They must not be held back behind a piece of state the effect sets,
  // which is what this used to do - the effect reads the two elements out of
  // their refs, so gating the render on state the effect sets means the refs
  // are still empty when it runs, it gives up, and the state it was meant to
  // set never is. The marks never appeared at all.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-100">
      <div
        ref={ringRef}
        data-seen="no"
        data-over="no"
        className="cursor-ring-circle absolute top-0 left-0 size-9 rounded-full"
      >
        {/* The dashes are drawn rather than bordered so their count and their
            gaps are ours rather than the browser's, and they turn on their
            own element because the frame loop owns the ring's transform. */}
        <svg viewBox="0 0 100 100" className="cursor-ring-dash size-full">
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="7 6.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div
        ref={dotRef}
        data-seen="no"
        data-over="no"
        className="cursor-ring-dot absolute top-0 left-0 size-1.75 rounded-full"
      />
    </div>
  );
}
