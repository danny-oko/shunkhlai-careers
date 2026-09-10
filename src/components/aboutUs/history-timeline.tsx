"use client";

import * as React from "react";

import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { milestones } from "@/lib/company";
import { cn } from "@/lib/utils";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * Бидний түүх, as a pinned horizontal run.
 *
 * The section is a tall runway with one screen pinned inside it; scrolling
 * down slides the milestones past sideways. It borrows the landing page's
 * grammar — a stage held while the scroll drives something across it — so the
 * two pages read as one site rather than a hero and a document.
 *
 * The travel is measured from the track, so the last card lands flush against
 * the right edge exactly as the runway ends.
 */
export function HistoryTimeline() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const [travel, setTravel] = React.useState(0);

  React.useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      setTravel(Math.max(track.scrollWidth - window.innerWidth, 0));
    };

    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section
      id="history"
      ref={sectionRef}
      className={cn(
        "relative scroll-mt-20",
        isReduced ? "h-auto" : "h-[300svh]",
      )}
    >
      <SectionRule />

      <div
        className={cn(
          "flex flex-col justify-center overflow-hidden",
          isReduced ? "relative py-20" : "sticky top-0 h-svh",
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
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
            "mt-14 flex w-max items-stretch gap-6 px-6 lg:px-10",
            isReduced && "no-scrollbar w-full overflow-x-auto",
          )}
          style={
            isReduced
              ? undefined
              : { transform: `translate3d(${-progress * travel}px, 0, 0)` }
          }
        >
          {milestones.map((milestone, index) => (
            <article
              key={milestone.period}
              className="flex w-[78vw] shrink-0 flex-col border-t-2 border-border pt-7 sm:w-[26rem]"
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
          ))}
        </div>

        <div className="mx-auto mt-12 w-full max-w-6xl px-6 lg:px-10">
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
