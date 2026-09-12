"use client";

import * as React from "react";

export type RailItem = { key: string; label: string; href?: string };

/**
 * A row of stops drawn as one track, with a lit marker sliding between them.
 *
 * Separate pills read as separate decisions. One track with a marker travelling
 * along it reads as a single control with several positions — which is what
 * these are, whether they scroll the page or swap a panel on it.
 *
 * The marker is one element that is moved and resized, never a background
 * turned on and off per stop. That is the whole effect: because it is one
 * object it has somewhere to travel from, and the eye follows it across the
 * gap instead of noticing two separate things change at once.
 *
 * Two shapes, one track. Given `onSelect` the stops are tabs and the marker
 * rests on `selected` when the pointer is away; without it they are links and
 * the marker shows only under the pointer.
 */
export function SectionRail({
  items,
  selected,
  onSelect,
  idPrefix,
  label,
  className,
  style,
}: {
  items: RailItem[];
  /** Where the marker rests when nothing is hovered. Omit for a hover-only rail. */
  selected?: number;
  /** Given, the stops become tabs and this is called with the index chosen. */
  onSelect?: (index: number) => void;
  /** Ties each tab to its panel; required whenever `onSelect` is given. */
  idPrefix?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(
    null,
  );

  const isTabs = Boolean(onSelect);
  const lit = hovered ?? selected ?? null;

  // Measured rather than worked out: the stops are as wide as their words, and
  // the words are set in a web font that may not have arrived yet.
  React.useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      if (lit === null) return setBox(null);
      const stop = track.querySelector<HTMLElement>(`[data-rail-stop="${lit}"]`);
      setBox(stop ? { left: stop.offsetLeft, width: stop.offsetWidth } : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [lit, items]);

  /**
   * On a narrow screen the track is wider than the window, and a tab chosen
   * from somewhere else — a link carrying its hash, an arrow key — can be
   * sitting off the edge of it. Bring it into the scroller, and only far
   * enough: scrollIntoView would drag the page around with it.
   */
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track || selected === undefined) return;

    const stop = track.querySelector<HTMLElement>(
      `[data-rail-stop="${selected}"]`,
    );
    if (!stop) return;

    const gutter = 24;
    const left = track.offsetLeft + stop.offsetLeft - gutter;
    const right = left + stop.offsetWidth + gutter * 2;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";

    if (left < scroller.scrollLeft) {
      scroller.scrollTo({ left, behavior });
    } else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({ left: right - scroller.clientWidth, behavior });
    }
  }, [selected]);

  const stopAt = (target: EventTarget | null) => {
    const stop = (target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-rail-stop]",
    );
    // Nothing found means the pointer is on the track's own padding, between
    // two stops. What was lit stays lit: clearing it there would blink the
    // marker out and back every time the pointer crossed a gap.
    if (stop) setHovered(Number(stop.dataset.railStop));
  };

  /** Arrow keys walk the track, as a tablist is expected to. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!onSelect || selected === undefined) return;

    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const next = step
      ? (selected + step + items.length) % items.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : -1;
    if (next < 0) return;

    event.preventDefault();
    onSelect(next);
    trackRef.current
      ?.querySelector<HTMLElement>(`[data-rail-stop="${next}"]`)
      ?.focus();
  };

  const stopClass = (index: number) =>
    `relative inline-flex h-9 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand/60 motion-reduce:transition-none ${
      lit === index ? "text-brand-foreground" : "text-ink-muted"
    }`;

  return (
    // Bleeds to the window edge on a narrow screen so the track scrolls rather
    // than breaking over three lines, which would undo the one-object read.
    <div
      ref={scrollerRef}
      className={`no-scrollbar -mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0 ${className ?? ""}`}
      style={style}
    >
      <div
        ref={trackRef}
        role={isTabs ? "tablist" : undefined}
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerOver={(event) => stopAt(event.target)}
        onPointerLeave={() => setHovered(null)}
        // focus and blur, unlike the CSS pseudo-classes, reach the track from
        // the control inside it, so the same marker answers the keyboard.
        onFocus={(event) => stopAt(event.target)}
        onBlur={() => setHovered(null)}
        className="relative inline-flex w-max rounded-full border border-white/15 p-1"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full transition-[transform,width,opacity] duration-300 ease-out motion-reduce:transition-none"
          style={{
            backgroundImage: "var(--brand-gradient)",
            transform: `translate3d(${box?.left ?? 0}px, 0, 0)`,
            width: box?.width ?? 0,
            opacity: box ? 1 : 0,
          }}
        />

        {items.map((item, index) =>
          onSelect ? (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${item.key}`}
              aria-controls={`${idPrefix}-panel-${item.key}`}
              aria-selected={selected === index}
              // Roving: the track is one stop on the page's tab order, and the
              // arrow keys move within it.
              tabIndex={selected === index ? 0 : -1}
              data-rail-stop={index}
              onClick={() => onSelect(index)}
              className={stopClass(index)}
            >
              {item.label}
            </button>
          ) : (
            <a
              key={item.key}
              href={item.href}
              data-rail-stop={index}
              className={stopClass(index)}
            >
              {item.label}
            </a>
          ),
        )}
      </div>
    </div>
  );
}
