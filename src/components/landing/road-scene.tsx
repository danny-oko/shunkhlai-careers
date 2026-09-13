"use client";

import * as React from "react";

import { MongoliaMap } from "@/components/landing/mongolia-map";
import {
  Tanker,
  TANKER_BASE_GAP,
  TANKER_WHEEL_RADIUS,
} from "@/components/landing/tanker";
import { stats } from "@/lib/company";

/** How far the road markings travel across the run, in pixels. */
const ROAD_TRAVEL = 5200;

/**
 * Wheel rotation, taken from the ground rather than picked by eye.
 *
 * At its widest the tanker is drawn about TANKER_WIDTH across, which puts the
 * tyre a little over 200px around. Turning it by however many rotations the
 * road travels is what stops it looking like it is sliding.
 */
const TANKER_WIDTH = 896;
const WHEEL_CIRCUMFERENCE = 2 * Math.PI * TANKER_WHEEL_RADIUS * TANKER_WIDTH;
const WHEEL_TURN = (ROAD_TRAVEL / WHEEL_CIRCUMFERENCE) * 360;
const WHEEL_ENTRY = (1700 / WHEEL_CIRCUMFERENCE) * 360;

/**
 * The chain the tanker is one link in, from HR's own description of the
 * business: import, storage, haulage, retail, with the lab over all of it.
 */
const chain = [
  {
    title: "Импорт",
    body: "Газрын тосны бүтээгдэхүүнийг улсын хилээр оруулж ирнэ.",
  },
  { title: "Хадгалалт", body: "8 бүсийн агуулахад стандартын дагуу хадгална." },
  {
    title: "Тээвэрлэлт",
    body: "Өөрийн авто тээврийн бааз 21 аймаг руу хүргэнэ.",
  },
  {
    title: "Борлуулалт",
    body: "100 гаруй шатахуун түгээх станцаар хэрэглэгчдэд хүрнэ.",
  },
  {
    title: "Чанарын хяналт",
    body: "Улсын итгэмжлэгдсэн лаборатори бүтээгдэхүүнийг баталгаажуулна.",
  },
];

/**
 * The artwork, as shares of the box it is drawn in: the truck itself occupies
 * rows 158-672 of 770, so it fills 0.668 of the box and its middle sits at
 * 0.539 down. With the 0.125 gap under the tyres, that puts the truck's centre
 * line 0.336 of a box-height above the bottom of the ink band, and a cap
 * height matching the truck needs a font 0.927 of the box tall.
 */
const TRUCK_CONTENT = 0.668;
const TRUCK_MID_OFFSET = 1 - 0.539 - TANKER_BASE_GAP;
/** A shade under the truck's own height, so the line sits inside it. */
const TRUCK_FONT = (TRUCK_CONTENT * 0.82) / 0.72;

/** Element width and viewport width, kept current across resizes. */
function useTravel(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState({ track: 0, view: 0 });

  React.useEffect(() => {
    const measure = () =>
      setSize({
        track: ref.current?.scrollWidth ?? 0,
        view: window.innerWidth,
      });

    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);

  return size;
}

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * The schedule the instruments arrive on, in shares of the drive.
 *
 * Eight slots — four figures, then the five cards overlapping the last of
 * them — with the last slot finishing where the map does. The map plants its
 * final pin at 0.93 of the run, and the two landing together is the point:
 * on the old step the cards were all in by 0.52, which left the whole second
 * half of the section as a finished caption sitting over a map still
 * unfolding behind it.
 */
const TEXT_END = 0.93;
const TEXT_SPAN = 0.24;
const TEXT_SLOTS = 8;
const TEXT_STEP = (TEXT_END - TEXT_SPAN) / (TEXT_SLOTS - 1);

/**
 * How far into its own arrival the item in slot `index` is.
 *
 * Two readings of the same share: `shown` is eased, so the item arrives
 * quickly and settles, while `t` is left linear for the glint to ride — an
 * eased sweep spends most of its length parked at the far edge and the light
 * appears to stall halfway across.
 */
function reveal(drive: number, index: number, settled = false) {
  const t = settled ? 1 : clamp((drive - index * TEXT_STEP) / TEXT_SPAN);
  // easeOutCubic — it arrives quickly and settles rather than gliding in.
  return { t, shown: 1 - Math.pow(1 - t, 3) };
}

/**
 * The two custom properties `.gleam-in` reads, as strings: React appends
 * `px` to bare numbers on some properties, and a unitless share is what the
 * calc() in the stylesheet needs. The heat is a bell over the sweep, so the
 * glow is brightest with the band mid-word.
 */
const gleam = (t: number) =>
  ({
    "--gleam": t.toFixed(3),
    "--gleam-heat": Math.sin(t * Math.PI).toFixed(3),
  }) as React.CSSProperties;

/**
 * A tanker held in the middle of the frame while the world is pulled past it,
 * so scrolling reads as driving.
 *
 * Behind it stands the country the fleet covers, drawn with the same dotted
 * mask as the opening loader. The figures that measure that reach count out
 * one at a time along the top of the ink band, with the chain of cards below
 * them. Nothing slides across the screen any more — it all arrives in place.
 */
export function RoadScene({
  enter,
  drive,
  kmh,
  fade = 1,
  settled = false,
}: {
  /** 0 while the tanker is still off the left edge, 1 once it has arrived. */
  enter: number;
  drive: number;
  kmh: number;
  fade?: number;
  /** Show every figure and card at once — `drive` is frozen part-way under
      reduced motion, and the late slots would never come up otherwise. */
  settled?: boolean;
}) {
  // How far the chain of cards has been swiped, for the affordance under it.
  // Below `lg` the chain is a scrolling strip with its scrollbar hidden, which
  // left nothing at all to say it could be moved: on a phone you saw two cards
  // and no reason to think there were five.
  const chainRef = React.useRef<HTMLDivElement>(null);
  const [swipe, setSwipe] = React.useState({ at: 0, seen: 0, all: 0 });

  const onChainScroll = () => {
    const strip = chainRef.current;
    if (!strip) return;
    setSwipe({
      at: strip.scrollLeft,
      seen: strip.clientWidth,
      all: strip.scrollWidth,
    });
  };

  React.useEffect(onChainScroll, []);

  const runway = Math.max(swipe.all - swipe.seen, 0);
  const swiped = runway > 0 ? swipe.at / runway : 0;
  const thumb = swipe.all > 0 ? swipe.seen / swipe.all : 1;

  const lineRef = React.useRef<HTMLDivElement>(null);
  const truckRef = React.useRef<HTMLDivElement>(null);
  const line = useTravel(lineRef);
  const [truckBox, setTruckBox] = React.useState(0);

  React.useEffect(() => {
    const measure = () => setTruckBox(truckRef.current?.offsetHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Enters at the right edge, gone once its own width has passed the left, so
  // the sentence completes exactly one pass across the run.
  const lineX = line.view - drive * (line.view + line.track);

  return (
    <>
      {/* Behind the tanker and matched to it: the line is set as tall as the
          truck and centred on the same axis, so it reads as the road it is on
          rather than as a caption floating above. */}
      <div
        ref={lineRef}
        aria-hidden
        className="absolute left-0 leading-none font-semibold tracking-[-0.035em] whitespace-nowrap text-foreground/[0.07]"
        style={{
          bottom: `calc(40% + ${TRUCK_MID_OFFSET * truckBox}px)`,
          fontSize: `${TRUCK_FONT * truckBox}px`,
          transform: `translate3d(${lineX}px, 50%, 0)`,
          visibility: line.track && truckBox ? "visible" : "hidden",
        }}
      >
        Монгол улсын алслагдсан сум хүртэл
      </div>

      {/* Sized to sit whole inside the dark band above the road. Width alone
          could not promise that — a short, wide window would push it past the
          bottom — so it is also capped against the viewport height: at a 2.79
          ratio, 145svh of width is 52svh of height, inside the band's 60svh. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 flex h-[60%] items-center justify-center overflow-hidden opacity-60"
      >
        <div className="w-[88vw] max-w-[145svh]">
          <MongoliaMap className="w-full" progress={drive} />
        </div>
      </div>

      {/* Sits on the top edge of the ink band, nudged down by the empty strip
          the artwork leaves below the tyres. It drives in from off the left
          edge, which is what clears the sentence off the screen. */}
      <div
        ref={truckRef}
        className="absolute inset-x-0 bottom-[40%]"
        style={{
          transform: `translate3d(${(enter - 1) * 118}%, ${TANKER_BASE_GAP * 100}%, 0)`,
        }}
      >
        <Tanker
          wheelAngle={enter * WHEEL_ENTRY + drive * WHEEL_TURN}
          className="mx-auto w-[92vw] max-w-4xl drop-shadow-[0_28px_44px_rgb(0_0_0/18%)] lg:w-[86vw]"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[40%] overflow-hidden bg-ink text-ink-foreground [--gleam-base:var(--ink-foreground)] [--gleam-sheen:var(--sheen-cool)]">
        {/* Road markings. Scrolled by moving the repeating gradient itself
            rather than by translating the element: a translated element is
            finite and runs out, which left the dashes stopping mid-screen. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-4 h-[3px]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, color-mix(in oklab, var(--ink-muted) 55%, transparent) 0 72px, transparent 72px 156px)",
            backgroundPositionX: `${-drive * ROAD_TRAVEL}px`,
          }}
        />

        <div
          className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-4 px-6 pt-12 transition-opacity duration-500 lg:grid-cols-4 lg:px-10"
          style={{ opacity: fade }}
        >
          {stats.map((stat, index) => {
            const { t, shown } = reveal(drive, index, settled);
            return (
              <div
                key={stat.label}
                className="text-center"
                style={{
                  ...gleam(t),
                  opacity: shown,
                  transform: `translate3d(0, ${(1 - shown) * 14}px, 0)`,
                }}
              >
                {/* The brand orange, and its own lighter orange for the light that
                    travels through it. The band's sheen is the cool blue-white
                    every other line here takes, and over orange that is what
                    was turning the figures to tan — the sweep never fully left
                    them, so the colour they settled on was orange mixed with a
                    blue. Warm sheen on warm base keeps the whole sweep inside
                    the orange. */}
                <span className="gleam-in text-3xl leading-none font-semibold tracking-[-0.04em] tabular-nums [--gleam-base:var(--brand)] [--gleam-sheen:var(--brand-2)] sm:text-5xl">
                  {stat.value}
                  {stat.suffix}
                </span>
                <span className="gleam-in mt-2 block text-sm font-medium tracking-[-0.01em]">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="absolute inset-x-0 bottom-0 transition-opacity duration-500"
          style={{ opacity: fade }}
        >
        <div
          ref={chainRef}
          onScroll={onChainScroll}
          // Same line as everything else on the page: on a narrow screen the
          // strip starts at the gutter and scrolls off the right, and from lg
          // the five sit inside the container the header and footer use.
          className="no-scrollbar mx-auto flex max-w-6xl overflow-x-auto pl-(--page-gutter) lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-10"
        >
          {chain.map((link, index) => {
            // Slot 3 onwards: the chain starts under the last of the figures,
            // so the two groups read as one run rather than two.
            const { t, shown } = reveal(drive, index + 3, settled);
            return (
              <article
                key={link.title}
                // The first card is the one that has to sit on the page's line, so it
                // gives up the indent and the rule its neighbours carry; the
                // strip's own padding is what puts it there.
                className="w-64 shrink-0 border-l border-white/12 pt-5 pr-6 pb-6 pl-5 first:border-l-0 first:pl-0 lg:w-auto lg:px-6 lg:first:pl-0"
                style={{
                  ...gleam(t),
                  opacity: shown,
                  transform: `translate3d(${(shown - 1) * 40}px, 0, 0)`,
                }}
              >
                {/* The step up waits for xl. At lg the five columns are 189px wide and
                    "Чанарын хяналт" measures 159 at 20px, which wrapped that one
                    title and left the row uneven. */}
                <h3 className="gleam-in text-base font-semibold tracking-[-0.025em] xl:text-xl">
                  {link.title}
                </h3>
                <p className="gleam-in mt-2 text-sm leading-relaxed text-pretty [--gleam-base:var(--ink-muted)]">
                  {link.body}
                </p>
              </article>
            );
          })}
        </div>

          {/* Three things say the strip moves, and only on the screens where
              it does: the ink fades in over the right-hand edge while there is
              more to come, a bar under it shows how much of the run has been
              covered, and the bar is live, so the first swipe is answered. */}
          {runway > 0 && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-ink to-transparent transition-opacity duration-300 lg:hidden"
                style={{ opacity: 1 - swiped }}
              />
              <div
                aria-hidden
                className="mx-6 mt-1 mb-4 h-px overflow-hidden rounded-full bg-white/15 lg:hidden"
              >
                <div
                  className="h-px rounded-full transition-transform duration-150 ease-out"
                  style={{
                    width: `${Math.max(thumb * 100, 12)}%`,
                    backgroundImage: "var(--brand-gradient)",
                    transform: `translateX(${(swiped * (100 / Math.max(thumb, 0.12) - 100)).toFixed(1)}%)`,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="absolute inset-x-0 top-0 pt-20 transition-opacity duration-500"
        style={{ opacity: fade }}
      >
        {/* Same container as the site header — padding inside the max-width,
            not around it — so the readouts line up with the wordmark and the
            button above them. */}
        <div className="mx-auto flex max-w-6xl items-start justify-between px-6 font-mono text-xs tracking-[0.12em] uppercase lg:px-10">
          <span className="tabular-nums">{kmh} км/ц</span>
          <span className="text-muted-foreground">
            {Math.round(drive * 100)}%
          </span>
        </div>
      </div>
    </>
  );
}
