"use client";

import * as React from "react";

import { SectionRule } from "@/components/brand/section-rule";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { eras } from "@/lib/company";
import { cn } from "@/lib/utils";

/** How much scroll one record is held for, once the stage is pinned. */
const STEP_SVH = 60;

/** Below this the stage is not pinned: the row stacks and outgrows a screen. */
const WIDE = "(min-width: 64rem)";

/** The tile grid the photograph changes through. */
const COLS = 8;
const ROWS = 10;
const TILES = COLS * ROWS;

/** How long the band of tiles takes to sweep from the top of the frame down. */
const SWEEP_MS = 520;
/** How long one tile takes to open, once its turn comes. */
const TILE_MS = 380;
/** How ragged the band's edge is: each tile is offset by up to half of this. */
const SCATTER_MS = 170;
/** The whole change, to the last tile settling. */
const REVEAL_MS = SWEEP_MS + SCATTER_MS / 2 + TILE_MS;

/** Turns the index's travel from a jump into a slide. */
const MARK_MIN = 5;
const MARK_MAX = 40;

/** Degrees the rings turn over the whole run. */
const RING_TURN = 120;

/** Every record in reading order, carrying the span it belongs to. */
const slides = eras.flatMap((era, eraIndex) =>
  era.entries.map((entry, entryIndex) => ({ era, eraIndex, entry, entryIndex })),
);

/** The first record of each span, so the rail can jump straight to one. */
const eraStart = eras.map((_, eraIndex) =>
  slides.findIndex((slide) => slide.eraIndex === eraIndex),
);

/**
 * Each tile's own offset into the sweep, fixed for the life of the page.
 *
 * The band has to arrive at a tile's row at slightly the wrong moment for the
 * change to look like tiles rather than like a blind coming down, and the
 * scatter has to be the same every time or a tile that is mid-change when the
 * reader scrolls back would jump to a different phase.
 */
const scatter = Array.from({ length: TILES }, (_, index) => {
  const noise = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return (noise - Math.floor(noise) - 0.5) * SCATTER_MS;
});

/** The tiles, in their grid, each with the delay it opens on. */
const tiles = Array.from({ length: TILES }, (_, index) => {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const sweep = (row / (ROWS - 1)) * SWEEP_MS;

  return {
    index,
    delay: Math.max(0, sweep + scatter[index]),
    // Half a pixel of bleed on every edge: at these fractions the rounding
    // between two tiles can leave a hairline of the outgoing photograph
    // standing after both have opened.
    clip:
      `inset(calc(${(row * 100) / ROWS}% - 0.5px)` +
      ` calc(${100 - ((col + 1) * 100) / COLS}% - 0.5px)` +
      ` calc(${100 - ((row + 1) * 100) / ROWS}% - 0.5px)` +
      ` calc(${(col * 100) / COLS}% - 0.5px))`,
  };
});

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the window is wide enough to pin the stage. Assumes it is on the
 * server, which is the layout the markup is rendered for; a narrow client
 * corrects itself on its first paint and nothing visible depends on the
 * guess, since which index is read is the only thing that changes.
 */
function useIsWide() {
  return React.useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/**
 * Түүхэн замнал, as a screen held while the scroll reads through it.
 *
 * The section is a tall runway with one screen pinned inside it. Nothing in
 * that screen moves as you scroll - the scroll only says which of the twelve
 * records is open, and the photograph and the text change to it together, as
 * one step. Pinning is also what keeps the section to itself: unpinned, the
 * dark statement screen below sat in the bottom of every view of it.
 *
 * Three things carry the change, and all three are driven by the one number
 * the scroll produces:
 *
 * - The photograph opens a tile at a time, in a band sweeping down the frame.
 *   See `.history-tile` in globals.css for why each tile goes through the
 *   page's ground rather than straight from one photograph to the other.
 * - The index beside it is a thumb, not a set of states: the mark being read
 *   grows toward 40px as the one before it shrinks back to 5px, so it travels
 *   down the column with the scroll rather than jumping between marks.
 * - The rings behind the stage turn, slowly, across the whole run.
 *
 * Below the large breakpoint the row stacks and no longer fits a screen, so
 * the stage is not pinned there and the rail and the index set the record
 * directly instead. Reduced motion takes the same path, for the same reason
 * it always does: nothing should need to be scrolled through to be read.
 *
 * Every record is in the markup at all times, stacked in one grid cell and
 * faded between. The box is then as tall as the longest of the twelve however
 * short the open one is, so nothing under it moves as the run advances - and
 * the eleven that are not open are `inert`, so they are neither tabbed into
 * nor read out.
 */
export function HistoryTimeline() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const isWide = useIsWide();
  const [picked, setPicked] = React.useState(0);

  const isPinned = isWide && !isReduced;

  // Which record the scroll is on, and how far through it. Both come off the
  // same number, so the index cannot travel past a record still being read.
  const reach = progress * slides.length;
  const reached = Math.min(slides.length - 1, Math.max(0, Math.floor(reach)));
  const within = Math.min(1, Math.max(0, reach - reached));

  const active = isPinned ? reached : picked;
  const current = slides[active];

  // How far through the whole run, for the rings. Off the pinned scroll where
  // there is one, and off the record otherwise, so they turn either way.
  const runProgress = isPinned ? progress : picked / (slides.length - 1);

  // Where the index's thumb is, as a fraction of the open span's marks. It
  // runs past the last mark at the end of a span, which is what hands the
  // thumb over to the first mark of the next one.
  const lead = current.entryIndex + (isPinned ? within : 0);

  const { shown, incoming } = usePhotographChange(current.eraIndex, isReduced);

  /**
   * Take the reader to a record. While the stage is pinned the scroll owns
   * which one is open, so the rail cannot set it directly - it has to move
   * the page to where that record is read, and let the scroll do the rest.
   */
  const open = (target: number) => {
    const element = sectionRef.current;

    if (!isPinned || !element) {
      setPicked(target);
      return;
    }

    const rect = element.getBoundingClientRect();
    const runway = rect.height - window.innerHeight;
    // A tenth of a step in, so the record is open rather than on the seam
    // between it and the one before.
    const share = (target + 0.1) / slides.length;

    window.scrollTo({
      top: rect.top + window.scrollY + share * runway,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="history"
      ref={sectionRef}
      className="relative scroll-mt-16"
      style={
        isPinned
          ? { height: `calc(100svh + ${slides.length * STEP_SVH}svh)` }
          : undefined
      }
    >
      <SectionRule />

      {/* The clipping is on the stage, never on the section: an ancestor that
          clips its overflow becomes the scrollport a sticky child is measured
          against, and that one does not scroll, so the pin never takes. */}
      <div
        className={cn(
          "relative overflow-hidden",
          isPinned
            ? // pt-16 is the fixed header: the stage is pinned under it, so
              // the screen it centres its content in is the one below the
              // header, not the whole window.
              "sticky top-0 flex h-svh flex-col justify-center pt-16"
            : "py-20 lg:py-28",
        )}
      >
        <Rings turn={runProgress * RING_TURN} />

        <div className="relative z-[1] mx-auto w-full max-w-6xl px-6 lg:px-10">
          <h2 className="text-center text-sm font-medium tracking-[0.01em]">
            Түүхэн замнал
          </h2>

          <div className="mt-12 flex flex-col items-center gap-12 lg:mt-14 lg:flex-row lg:items-center lg:justify-between lg:gap-8 xl:gap-12">
            {/* The spans, right-aligned so their edge points at the
                photograph rather than trailing off into the page gutter. */}
            <ul className="flex w-full flex-wrap justify-center gap-x-7 gap-y-3 lg:w-auto lg:shrink-0 lg:flex-col lg:items-end lg:gap-7">
              {eras.map((era, index) => {
                const isCurrent = index === current.eraIndex;
                return (
                  <li key={era.period}>
                    <button
                      type="button"
                      onClick={() => open(eraStart[index])}
                      aria-current={isCurrent ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 text-[0.9375rem] font-medium tracking-[-0.01em] whitespace-nowrap transition-opacity duration-500 outline-none motion-reduce:transition-none",
                        "focus-visible:underline focus-visible:underline-offset-[6px] focus-visible:opacity-100",
                        isCurrent ? "opacity-100" : "opacity-30 hover:opacity-70",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full bg-brand transition-opacity duration-500 motion-reduce:transition-none",
                          isCurrent ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {era.period}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Photograph and index, bottom-aligned with each other. The
                photograph is sized off the window's height as well as its
                width, so the pinned screen holds it whole on a laptop. */}
            <div className="flex shrink-0 items-end gap-4">
              <div className="relative aspect-[900/1114] w-[min(var(--photo),52svh)] overflow-hidden rounded-[4px] bg-muted [--photo:15.5rem] sm:[--photo:19rem] lg:[--photo:21rem] xl:[--photo:24rem]">
                {/* The settled photograph. All four are in the frame rather
                    than only the open one, so that by the time a tile asks
                    for the next one it is already in the cache - a tile whose
                    background is still downloading opens onto nothing, and
                    the change is over in under a second.

                    Cropped to this frame's shape when they were put in
                    `public`, so they need no object-position and the tiles
                    over them line up with them exactly. */}
                {eras.map((era, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={era.image}
                    src={era.image}
                    alt={index === shown ? era.alt : ""}
                    aria-hidden={index !== shown}
                    width={900}
                    height={1114}
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "low"}
                    className={cn(
                      "absolute inset-0 size-full object-cover",
                      index === shown ? "opacity-100" : "opacity-0",
                    )}
                  />
                ))}

                {incoming !== null && (
                  // Keyed on the arriving span: a change that starts while
                  // another is still running replaces it from the top of the
                  // frame rather than carrying on mid-sweep with a new
                  // photograph in the tiles.
                  <div key={incoming} aria-hidden className="absolute inset-0">
                    {tiles.map((tile) => (
                      <div
                        key={tile.index}
                        className="history-tile absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${eras[incoming].image})`,
                          clipPath: tile.clip,
                          animationDelay: `${tile.delay}ms`,
                          animationDuration: `${TILE_MS}ms`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <ol className="flex shrink-0 flex-col items-center gap-5">
                {current.era.entries.map((entry, index) => {
                  // 1 on the mark being read, falling to 0 on its neighbours,
                  // so the thumb is always between two of them rather than in
                  // one or the other.
                  const weight = Math.max(0, 1 - Math.abs(lead - index));
                  return (
                    <li key={entry.title}>
                      {/* The mark is 5px wide; the padding is what the
                          finger and the pointer actually get. */}
                      <button
                        type="button"
                        onClick={() => open(eraStart[current.eraIndex] + index)}
                        aria-current={
                          index === current.entryIndex ? "true" : undefined
                        }
                        aria-label={`${current.era.period} - ${entry.title}`}
                        className="group -m-2 block rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className="block w-[5px] overflow-hidden rounded-full bg-foreground/20 group-hover:bg-foreground/45"
                          style={{
                            height: `${MARK_MIN + (MARK_MAX - MARK_MIN) * weight}px`,
                          }}
                        >
                          <span
                            className="block size-full rounded-full bg-brand"
                            style={{ opacity: weight }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* The record. All twelve are here; one is shown. */}
            <div className="grid w-full max-w-[28rem] lg:shrink">
              {slides.map((slide, index) => (
                <div
                  key={`${slide.era.period}-${slide.entry.title}`}
                  inert={index !== active}
                  className={cn(
                    "[grid-area:1/1] transition-opacity duration-500 ease-out motion-reduce:transition-none",
                    index === active ? "opacity-100" : "opacity-0",
                  )}
                >
                  <h3 className="text-xl leading-snug font-medium tracking-[-0.02em] text-balance sm:text-[1.375rem]">
                    {slide.entry.title}
                  </h3>
                  <p className="mt-5 text-[0.9375rem] leading-[1.75] text-foreground/65 hyphens-auto lg:text-justify">
                    {slide.entry.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Which photograph is settled in the frame, and which one is opening over it.
 *
 * The photograph belongs to the span rather than to the record, so it holds
 * still for the three records of a span and changes on the seam between two.
 * A change that is interrupted part-way - the reader scrolls on into a third
 * span, or back into the one it came from - is replaced rather than queued,
 * so the frame is never more than one change behind the scroll.
 */
function usePhotographChange(eraIndex: number, isReduced: boolean) {
  const [settled, setSettled] = React.useState(eraIndex);

  // Only the settled photograph is state. Which one is opening over it is
  // read off the two - the frame is changing exactly while the span the
  // scroll is on is not the one settled in it - so there is no second value
  // that can be left behind when a change is interrupted.
  const shown = isReduced ? eraIndex : settled;
  const incoming = shown === eraIndex ? null : eraIndex;

  React.useEffect(() => {
    if (incoming === null) return;

    const timer = window.setTimeout(() => setSettled(incoming), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  return { shown, incoming };
}

/**
 * The rings the stage stands on: broken concentric bands centred on the
 * stage's left edge, so only their right sides are in the page. They carry no
 * meaning; they give the wide empty left of the composition something to be,
 * and turning them is what keeps that side of the screen part of the run
 * rather than a still backdrop the records happen to pass in front of.
 *
 * Off below the large breakpoint, where the row stacks and there is no wide
 * empty left for them to fill.
 */
function Rings({ turn }: { turn: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-0 z-0 hidden size-[140svh] -translate-x-1/2 -translate-y-1/2 lg:block"
    >
      <svg viewBox="-700 -700 1400 1400" className="size-full text-foreground">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={46}
          opacity={0.055}
          transform={`rotate(${turn})`}
        >
          {[
            { r: 240, dash: [0.3, 0.09, 0.19, 0.42], offset: 0.05 },
            { r: 350, dash: [0.22, 0.12, 0.34, 0.32], offset: 0.41 },
            { r: 460, dash: [0.4, 0.1, 0.16, 0.34], offset: 0.18 },
            { r: 570, dash: [0.17, 0.14, 0.27, 0.42], offset: 0.63 },
            { r: 680, dash: [0.28, 0.11, 0.21, 0.4], offset: 0.3 },
          ].map(({ r, dash, offset }) => {
            const circumference = 2 * Math.PI * r;
            return (
              <circle
                key={r}
                r={r}
                strokeDasharray={dash
                  .map((share) => share * circumference)
                  .join(" ")}
                strokeDashoffset={offset * circumference}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
