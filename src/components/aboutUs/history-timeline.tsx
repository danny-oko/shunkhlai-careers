"use client";

import * as React from "react";

import { SectionRule } from "@/components/brand/section-rule";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { milestones } from "@/lib/company";
import { cn } from "@/lib/utils";

type Metrics = {
  /** Where the track starts, so the first card opens on the focus point. */
  start: number;
  /** How far it runs, to bring the last card onto the same point. */
  travel: number;
  /** Each card's centre, in track coordinates. */
  centres: number[];
  /** Where on the screen a card counts as being read. */
  focal: number;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Бидний түүх, as a pinned horizontal run.
 *
 * The section is a tall runway with one screen pinned inside it; scrolling
 * down slides the milestones past sideways. It borrows the landing page's
 * grammar — a stage held while the scroll drives something across it — so the
 * pages read as one site rather than a hero and a document.
 *
 * What the run is built around is the middle of the screen: a card takes the
 * brand rule, its full weight and a small lift as it passes through it, and
 * settles back either side. Without that the run was four cards of equal
 * weight sliding by and the reader had no reason to be looking at any one of
 * them. The dimming is slight on purpose — far enough to say which card is
 * being read, not so far that the other three stop being legible.
 *
 * An earlier cut also set the card's period huge and faint across the ground.
 * It does not survive the content: only one of the four periods is a year, and
 * at a size worth doing "Стандарт" ran half as wide again as the window and
 * two of them were on screen at once.
 *
 * The run is measured from the cards themselves and goes from the first card
 * on the focal point to the last one on it, so its length is the distance
 * between those two centres and nothing else. Taking it from the track's
 * overhang instead — how far it sticks out past the window — is what it used
 * to do, and that is a number that falls to zero as the window gets wider:
 * four cards are 1816px of track, so at 1728px the run was 88px and at 1920px
 * and up it was nothing at all, three screens of scroll pinned over a still
 * picture. Measured card to card it is one card-pitch per step on every
 * screen.
 */
export function HistoryTimeline() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);

  // Before paint: the run opens with the first card already on the focal
  // point, and measuring after the first paint would show it jump there.
  React.useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;

      const centres = ([...track.children] as HTMLElement[]).map(
        (card) => card.offsetLeft + card.offsetWidth / 2,
      );
      const focal = window.innerWidth / 2;

      setMetrics({
        focal,
        centres,
        start: centres[0] - focal,
        travel: centres[centres.length - 1] - centres[0],
      });
    };

    measure();
    // Web fonts change the card widths, so take the measurement again.
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const shift = metrics ? metrics.start + progress * metrics.travel : 0;

  /** 1 for the card on the focal point, 0 for one a half-screen off it. */
  const focus = (index: number) => {
    if (!metrics || isReduced) return 1;
    const onScreen = metrics.centres[index] - shift;
    return clamp(1 - Math.abs(onScreen - metrics.focal) / metrics.focal);
  };

  // Whichever card is nearest the focal point takes the brand rule. A plain
  // threshold on the focus cannot do it: halfway between two cards they are
  // level, and depending on the window that left either both of them lit or
  // neither.
  const lead = milestones.reduce(
    (best, _, index) => (focus(index) > focus(best) ? index : best),
    0,
  );

  return (
    <section
      id="history"
      ref={sectionRef}
      className={cn("relative scroll-mt-16", isReduced ? "h-auto" : "h-[300svh]")}
    >
      <SectionRule />

      <div
        className={cn(
          "flex flex-col justify-center overflow-hidden pt-16",
          isReduced ? "relative py-20" : "sticky top-0 h-svh",
        )}
      >
        <div className="relative mx-auto w-full max-w-6xl px-6 lg:px-10">
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Бидний түүх · Our story
          </p>
          <h2 className="mt-5 text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            30 гаруй жилийн зам
          </h2>
        </div>

        <div
          ref={trackRef}
          className={cn(
            // Left padding off the page's own gutter, not the window's, so
            // the first card starts on the line the heading above it does.
            "relative mt-14 flex w-max items-stretch gap-6 pr-6 pl-(--page-gutter) lg:pr-10",
            isReduced && "no-scrollbar w-full overflow-x-auto",
          )}
          style={
            isReduced ? undefined : { transform: `translate3d(${-shift}px, 0, 0)` }
          }
        >
          {milestones.map((milestone, index) => {
            const lit = focus(index);
            return (
              <article
                key={milestone.period}
                className={cn(
                  "flex w-[78vw] shrink-0 flex-col border-t-2 pt-7 transition-colors duration-500 sm:w-[26rem]",
                  index === lead ? "border-brand" : "border-border",
                )}
                style={{
                  opacity: 0.55 + lit * 0.45,
                  transform: `translate3d(0, ${(1 - lit) * 20}px, 0)`,
                }}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm tracking-[0.08em] text-brand tabular-nums">
                    {milestone.period}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {String(index + 1).padStart(2, "0")} / {milestones.length}
                  </span>
                </div>

                <h3 className="mt-5 text-2xl leading-tight font-semibold tracking-[-0.025em] sm:text-3xl">
                  {milestone.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
                  {milestone.body}
                </p>
              </article>
            );
          })}
        </div>

        <div className="relative mx-auto mt-12 w-full max-w-6xl px-6 lg:px-10">
          <div className="h-px w-full bg-border">
            <div
              className="h-px origin-left"
              style={{
                backgroundImage: "var(--brand-gradient)",
                transform: `scaleX(${isReduced ? 1 : progress})`,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
