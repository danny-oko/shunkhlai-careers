"use client";

import * as React from "react";

import { Tanker } from "@/components/landing/tanker";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { useScrollSpeed } from "@/components/landing/use-scroll-speed";
import { cn } from "@/lib/utils";

/** Degrees of wheel rotation across the whole run. */
const WHEEL_TURN = 2900;

const legs = [
  { at: 0, title: "Агуулахаас замд", note: "8 агуулах · тээврийн флот" },
  { at: 0.38, title: "21 аймгийн зам дээр", note: "Улаанбаатараас алслагдсан сум хүртэл" },
  { at: 0.72, title: "99+ станцад хүрнэ", note: "Өдөр бүр, цаг агаараас үл хамааран" },
];

/**
 * The road leg of the hero: a tanker held in the middle of a pinned stage
 * while the world is pulled past it, so scrolling reads as driving.
 *
 * Everything moves off one scroll position — the wheels, the road markings,
 * the type behind — and the gauge in the corner reports how fast the reader
 * is actually scrolling.
 */
export function HeroJourney() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const kmh = useScrollSpeed(!isReduced && progress > 0 && progress < 1);

  const leg = legs.reduce((found, item) => (progress >= item.at ? item : found), legs[0]);

  return (
    <section
      ref={sectionRef}
      aria-label="Шунхлайн тээврийн сүлжээ"
      className={cn("relative", isReduced ? "h-svh" : "h-[260svh]")}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Campaign lockup, dragged across behind everything else. */}
        <div
          aria-hidden
          className="absolute top-[38%] left-0 text-[19vw] leading-none font-semibold tracking-[-0.04em] whitespace-nowrap text-foreground/[0.055]"
          style={{ transform: `translate3d(${18 - progress * 150}vw, -50%, 0)` }}
        >
          ХӨДӨЛМӨР ХӨГЖЛИЙН ХӨДӨЛГҮҮР
        </div>

        {/* Anchored to the road, then nudged down by the gap the viewBox
            leaves below the tyres, so the wheels sit on the surface. */}
        <div className="absolute inset-x-0 bottom-[24%] translate-y-[10.5%]">
          <Tanker
            className="mx-auto w-[86vw] max-w-4xl drop-shadow-[0_24px_40px_rgb(0_0_0/12%)]"
            wheelAngle={progress * WHEEL_TURN}
          />
        </div>

        {/* Road. The markings are one repeating gradient, slid left. */}
        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-ink">
          <div
            aria-hidden
            className="absolute top-1/2 left-0 h-[4px] w-[500%] -translate-y-1/2"
            style={{
              transform: `translate3d(${-progress * 320}%, -50%, 0)`,
              backgroundImage:
                "repeating-linear-gradient(90deg, color-mix(in oklab, var(--ink-muted) 55%, transparent) 0 72px, transparent 72px 156px)",
            }}
          />
        </div>

        {/* Gauge and leg, laid out like an instrument panel. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-24 font-mono text-xs tracking-[0.12em] uppercase lg:px-10">
          <span className="tabular-nums">{kmh} км/ц</span>
          <span className="text-muted-foreground">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-6 pb-8 text-ink-foreground lg:px-10 lg:pb-10">
          <div key={leg.title} className="brand-word-in">
            <p className="text-2xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {leg.title}
            </p>
            <p className="mt-2 font-mono text-xs tracking-[0.1em] text-ink-muted uppercase">
              {leg.note}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
