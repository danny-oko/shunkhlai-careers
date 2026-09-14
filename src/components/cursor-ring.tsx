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
 * A ring and a dot in place of the arrow.
 *
 * The dot is exactly where the pointer is; the ring chases it a frame behind,
 * which is what makes it read as trailing the hand rather than being drawn on
 * it. Over anything pressable the ring opens out and takes the brand colour,
 * so the thing the arrow's hand used to say is still said.
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
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    setOn(true);
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

  if (!on) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-100">
      <div
        ref={ringRef}
        data-seen="no"
        data-over="no"
        className="cursor-ring-circle absolute top-0 left-0 size-9 rounded-full border border-foreground/35"
      />
      <div
        ref={dotRef}
        data-seen="no"
        data-over="no"
        className="cursor-ring-dot absolute top-0 left-0 size-1.5 rounded-full bg-foreground"
      />
    </div>
  );
}
