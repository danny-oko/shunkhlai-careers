"use client";

import * as React from "react";

import { SectionRule } from "@/components/brand/section-rule";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { eras } from "@/lib/company";
import { cn } from "@/lib/utils";

/** How much scroll one record is held for, once the stage is pinned. */
const STEP_SVH = 60;

/** The same on a phone, where a screen is shorter and a flick carries less. */
const NARROW_STEP_SVH = 45;

/** Below this the row stacks: the photograph sits over the record, not beside. */
const WIDE = "(min-width: 64rem)";

/**
 * Screens with the room to hold the pinned stage: the longest record, the
 * spans, the index and a photograph worth looking at, all inside
 * one screen. Measured, not guessed - at 375x667 that leaves the photograph
 * 210px and 24px to spare, and a screen narrower or shorter than the floor
 * below runs the record past the fold. Those fall back to the plain stacked
 * run instead, as a phone on its side does.
 */
const HOLDS_STAGE =
  "(min-width: 64rem), (min-width: 22.5rem) and (min-height: 40rem)";

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

/**
 * And how long the photograph being replaced takes to clear, where the one
 * arriving will not cover it.
 *
 * A tile carries the arriving photograph and nothing else, so where that
 * photograph is not - the band an archive picture leaves at the top and
 * bottom of the frame, or down its sides - an opened tile is transparent and
 * what shows through it is the photograph underneath. Against a span
 * photograph, which fills the frame, that left the old picture standing
 * around the new one for the length of the sweep: two photographs in one
 * frame, which is the one thing this change is supposed to avoid.
 *
 * So it is faded out under the sweep rather than dropped at the end of it,
 * and it is gone before the last tiles open. Only against an arriving picture
 * that does not cover the frame: where the next one does, the tiles wipe it
 * themselves, and holding it intact underneath is what makes the change read
 * as one photograph being drawn over another.
 */
const CLEAR_MS = SWEEP_MS + TILE_MS / 2;

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

type Photo = {
  src: string;
  alt: string;
  /**
   * How it sits in the frame.
   *
   * The span photographs were cropped to the frame's shape when they were put
   * in `public`, so they fill it. A record's own archive photograph came off
   * the history poster at the size and shape the poster held it - 245 to
   * 400px across, portrait or landscape - so it is shown whole on the frame's
   * plate instead. Cropping one to a tall frame would throw away most of the
   * picture and then enlarge what was left.
   */
  fit: "cover" | "contain";
};

/**
 * Every photograph the stage can show, and which one each record asks for.
 *
 * A record with its own picture shows that; the rest show their span's. The
 * list is deduplicated because the four span photographs are each asked for
 * by several records, and the frame holds one <img> per photograph.
 */
const { photos, photoOf } = (() => {
  const photos: Photo[] = [];
  const seen = new Map<string, number>();

  const photoOf = slides.map(({ era, entry }) => {
    const src = entry.image ?? era.image;
    const known = seen.get(src);
    if (known !== undefined) return known;

    const index = photos.length;
    photos.push({
      src,
      alt: entry.image ? (entry.imageAlt ?? "") : era.alt,
      fit: entry.image ? "contain" : "cover",
    });
    seen.set(src, index);
    return index;
  });

  return { photos, photoOf };
})();

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

/**
 * Whether a media query holds, kept in sync if the window changes. Assumes it
 * does on the server, which is the layout the markup is rendered for; a client
 * it does not hold on corrects itself on its first paint, and nothing visible
 * depends on the guess - it only decides which record is read.
 */
function useMedia(query: string) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}

/**
 * Түүхэн замнал, as a screen held while the scroll reads through it.
 *
 * The section is a tall runway with one screen pinned inside it. Nothing in
 * that screen moves as you scroll - the scroll only says which record is open, and the photograph and the text change to it together, as
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
 * Below the large breakpoint the row stacks into a column and the screen is
 * still pinned, so the photograph holds and changes there as it does on a
 * laptop. What the column leaves over is what the photograph is then sized
 * to, so the record under it stays on the screen the stage is held in. Only a
 * window without the room for one - a phone on its side, or one small enough
 * that the longest record fills it by itself - drops the pin and lets the
 * rail and the index set the record directly. Reduced motion takes that
 * same path, for the reason it always does: nothing should need to be
 * scrolled through to be read.
 *
 * Every record is in the markup at all times, stacked in one grid cell and
 * faded between. The box is then as tall as the longest of them however
 * short the open one is, so nothing under it moves as the run advances - and
 * the ones that are not open are `inert`, so they are neither tabbed into
 * nor read out.
 */
export function HistoryTimeline() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const isWide = useMedia(WIDE);
  const hasRoom = useMedia(HOLDS_STAGE);
  const [picked, setPicked] = React.useState(0);

  const isPinned = hasRoom && !isReduced;
  const step = isWide ? STEP_SVH : NARROW_STEP_SVH;

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

  const { shown, incoming } = usePhotographChange(photoOf[active], isReduced);

  // Whether the arriving photograph leaves a band of the frame uncovered, and
  // therefore whether the one it replaces has to clear rather than be wiped.
  // See CLEAR_MS.
  const clearing = incoming !== null && photos[incoming].fit !== "cover";

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
          ? { height: `calc(100svh + ${slides.length * step}svh)` }
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
              // header, not the whole window. Stacked, the column fills that
              // screen rather than sitting in the middle of it, so the room
              // the centring would have left it is asked for as padding.
              "sticky top-0 flex h-svh flex-col justify-center pt-22 pb-6 lg:pt-16 lg:pb-0"
            : "py-20 lg:py-28",
        )}
      >
        <Rings turn={runProgress * RING_TURN} />

        <div
          className={cn(
            "relative z-[1] mx-auto w-full max-w-6xl px-6 lg:px-10",
            // Stacked and pinned - a phone - the column has one screen to
            // fill and to stay inside, so it is laid out as a flex column
            // and the photograph takes whatever the rest of it leaves.
            isPinned && "flex min-h-0 flex-1 flex-col lg:block lg:flex-none",
          )}
        >
          <h2 className="text-center text-sm font-medium tracking-[0.01em]">
            Түүхэн замнал
          </h2>

          <div
            className={cn(
              "mt-12 flex flex-col items-center gap-12 lg:mt-14 lg:flex-row lg:items-center lg:justify-between lg:gap-8 xl:gap-12",
              isPinned &&
                "mt-6 min-h-0 flex-1 justify-center gap-5 sm:mt-8 sm:gap-7 lg:mt-14 lg:flex-none lg:gap-8",
            )}
          >
            {/* The spans, right-aligned so their edge points at the
                photograph rather than trailing off into the page gutter. */}
            <ul className="flex w-full shrink-0 items-start justify-between gap-x-2 sm:justify-center sm:gap-x-8 lg:w-auto lg:flex-col lg:items-end lg:gap-7">
              {eras.map((era, index) => {
                const isCurrent = index === current.eraIndex;
                return (
                  <li key={era.period}>
                    <button
                      type="button"
                      onClick={() => open(eraStart[index])}
                      aria-current={isCurrent ? "true" : undefined}
                      className={cn(
                        // Four spans in one row on a phone, with the mark
                        // under the label rather than beside it: the column
                        // has the height to spare and none of the width.
                        "flex flex-col-reverse items-center gap-1.5 text-[0.75rem] font-medium tracking-[-0.01em] whitespace-nowrap transition-opacity duration-500 outline-none sm:text-[0.875rem] lg:flex-row lg:gap-2.5 lg:text-[0.9375rem] motion-reduce:transition-none",
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
            <div
              className={cn(
                "flex items-end gap-4 lg:shrink-0",
                // Whatever the rail and the record leave of the screen, down
                // to a floor and up to a ceiling, so the frame neither
                // swallows a tall screen nor crushes a short one.
                isPinned &&
                  "max-h-96 min-h-36 w-full flex-1 justify-center gap-3 sm:gap-4 lg:max-h-none lg:min-h-0 lg:w-auto lg:flex-none",
              )}
            >
              <div
                className={cn(
                  "relative aspect-[900/1114] w-[min(var(--photo),52svh)] overflow-hidden rounded-[4px] [--photo:15.5rem] sm:[--photo:19rem] lg:[--photo:21rem] xl:[--photo:24rem]",
                  // The loading plate is for a photograph that fills the
                  // frame. An archive one is shown whole, and the rings
                  // behind the stage should carry on through the band it
                  // leaves rather than stopping at a grey rectangle.
                  photos[shown].fit === "cover" && "bg-muted",
                  // Height first and width off the shape, which is the other
                  // way round from the laptop: there the width is what is
                  // scarce, here it is the height.
                  isPinned &&
                    "h-full w-auto lg:h-auto lg:w-[min(var(--photo),52svh)]",
                )}
              >
                {/* The settled photograph. All of them are in the frame
                    rather than only the open one, so that by the time a tile
                    asks for the next one it is already in the cache - a tile
                    whose background is still downloading opens onto nothing,
                    and the change is over in under a second.

                    The span photographs were cropped to this frame's shape
                    when they were put in `public`, so they need no
                    object-position and the tiles over them line up with them
                    exactly. The archive ones are shown whole; see `fit`. */}
                {photos.map((photo, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.src}
                    src={photo.src}
                    alt={index === shown ? photo.alt : ""}
                    aria-hidden={index !== shown}
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "low"}
                    className={cn(
                      "absolute inset-0 size-full",
                      photo.fit === "cover" ? "object-cover" : "object-contain",
                      index === shown ? "opacity-100" : "opacity-0",
                    )}
                    style={
                      clearing && index === shown
                        ? {
                            opacity: 0,
                            transition: `opacity ${CLEAR_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
                          }
                        : undefined
                    }
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
                        className={cn(
                          "history-tile absolute inset-0 bg-center bg-no-repeat",
                          photos[incoming].fit === "cover"
                            ? "bg-cover"
                            : "bg-contain",
                        )}
                        style={{
                          backgroundImage: `url(${photos[incoming].src})`,
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

            {/* The record. All of them are here; one is shown. */}
            <div
              className={cn(
                "grid w-full max-w-[28rem] lg:shrink",
                // The record is read in full or the pin is not worth having,
                // so it is the photograph above it that gives way, not this.
                isPinned && "shrink-0",
              )}
            >
              {slides.map((slide, index) => (
                <div
                  key={`${slide.era.period}-${slide.entry.title}`}
                  inert={index !== active}
                  className={cn(
                    "[grid-area:1/1] transition-opacity duration-500 ease-out motion-reduce:transition-none",
                    index === active ? "opacity-100" : "opacity-0",
                  )}
                >
                  {/* The year after the name, in the brand orange.
 
                      Inside the heading rather than over it, so a reader who
                      cannot see the colour still gets "Жи Эс Би Капитал ББСБ
                      2010" as one line and not a stray number beside it.
                      `tabular-nums` because these change on the
                      same spot as the panel cross-fades, and lining figures
                      keep that spot still. */}
                  <h3 className="text-lg leading-snug font-medium tracking-[-0.02em] text-balance sm:text-[1.375rem]">
                    {slide.entry.title}
                    <span className="ml-3 font-semibold tabular-nums text-brand">
                      {slide.entry.year}
                    </span>
                  </h3>
                  <p className="mt-4 text-[0.875rem] leading-[1.7] text-foreground/65 hyphens-auto sm:mt-5 sm:text-[0.9375rem] sm:leading-[1.75] lg:text-justify">
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
 * A record with an archive photograph of its own brings it into the frame;
 * the records without one leave their span's photograph standing, so it holds
 * still across them and changes on the seam where the picture does. A change
 * interrupted part-way - the reader scrolls on to a third picture, or back to
 * the one it came from - is replaced rather than queued, so the frame is
 * never more than one change behind the scroll.
 */
function usePhotographChange(photoIndex: number, isReduced: boolean) {
  const [settled, setSettled] = React.useState(photoIndex);

  // Only the settled photograph is state. Which one is opening over it is
  // read off the two - the frame is changing exactly while the picture the
  // scroll is on is not the one settled in it - so there is no second value
  // that can be left behind when a change is interrupted.
  const shown = isReduced ? photoIndex : settled;
  const incoming = shown === photoIndex ? null : photoIndex;

  React.useEffect(() => {
    if (incoming === null) return;

    const timer = window.setTimeout(() => setSettled(incoming), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  return { shown, incoming };
}

/**
 * The rings the stage stands on: broken concentric bands centred on the
 * stage's left edge, so only their right sides are in the page. Drawn in the
 * brand orange, well under strength. They carry no meaning; they give the
 * wide empty left of the composition something to be,
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
      <svg viewBox="-700 -700 1400 1400" className="size-full text-brand">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={46}
          // Brand orange is a far lighter colour than the near-black this
          // used to be drawn in, so at the old 0.055 it washed out to almost
          // nothing. Raised until the bands carry the same weight on the page
          // as the grey did, and read as orange rather than as a warm white.
          opacity={0.12}
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
