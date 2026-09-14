"use client";

import * as React from "react";

import { RoadScene } from "@/components/landing/road-scene";
import { StatementLayer } from "@/components/landing/statement-layer";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { useScrollSpeed } from "@/components/landing/use-scroll-speed";
import { cn } from "@/lib/utils";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * How much of the runway the sentence simply holds for, filling the screen,
 * before anything begins to move.
 *
 * Without it the sentence started dissolving on the first notch of the wheel,
 * so the one thing on the page that is meant to be read was leaving before it
 * had been. 70svh of the 490svh runway — long enough to read the sentence on,
 * short of the screen and a bit that first held it, which read as the page
 * having stopped responding. The section carries exactly this much extra
 * length, so everything after the hold keeps the length it was tuned at.
 */
const HOLD = 70 / 490;

/**
 * The rest of the runway, in shares of its own length. The three overlap on
 * purpose: the tanker is already on its way in while the sentence is still
 * dissolving, and the instruments arrive last, so nothing in the scene changes
 * hands abruptly.
 *
 * The shares are small because the section is long: the opening takes about a
 * screen of scroll and everything after it is the drive. They were tuned
 * against a 320svh section, and lengthening that stretched the opening along
 * with the run — which left the ink band empty far too long.
 */
const STATEMENT_OUT = [0, 0.16] as const;
const TANKER_IN = [0.05, 0.22] as const;
const INSTRUMENTS_IN = [0.15, 0.26] as const;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** Position within a sub-range of the runway, 0 to 1. */
const ramp = (value: number, [from, to]: readonly [number, number]) =>
  clamp((value - from) / (to - from));

/** Gentle at both ends — nothing starts or stops with a jolt. */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
/** Fast off the mark, settling in — how something arriving comes to rest. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The sentence, then the road — one pinned stage for both.
 *
 * The screen opens filled by the statement and holds there for the first
 * stretch of the scroll. Past that, scrolling softens and dissolves it while
 * the tanker is already driving in from the left behind it; the
 * ground clears last, the instruments fade up, and the run proper begins with
 * the chain of cards streaming in along the bottom.
 *
 * Keeping both in one stage is what lets the tanker arrive *over* the type
 * rather than after it.
 */
export function HeroJourney() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  const [isShown, setIsShown] = React.useState(false);

  React.useEffect(() => {
    // Watch the stage, not the section. The section is several screens, so a
    // share-of-the-element threshold on it is unusable — 20% is more than a
    // screen and never fires, and 0 fires a screen early, while the sentence
    // is still a sliver at the bottom and the swing plays unseen. The stage
    // is exactly one viewport tall, so 0.9 means "filling the screen now".
    const element = stageRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsShown(true);
        observer.disconnect();
      },
      { threshold: 0.9 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Everything is driven off the runway past the hold, so the scene is exactly
  // as it opened until the reader has had the sentence for a screen or so.
  const run = clamp((progress - HOLD) / (1 - HOLD));

  const enter = isReduced ? 1 : easeOut(ramp(run, TANKER_IN));
  const exit = isReduced ? 0 : easeInOutSine(ramp(run, STATEMENT_OUT));
  const instruments = isReduced ? 1 : ramp(run, INSTRUMENTS_IN);
  const drive = isReduced
    ? 0.35
    : clamp((run - TANKER_IN[1]) / (1 - TANKER_IN[1]));
  const kmh = useScrollSpeed(!isReduced && enter > 0.9 && drive < 1);

  return (
    <section
      ref={sectionRef}
      data-statement-shown={isShown}
      className={cn("relative", isReduced ? "h-auto" : "h-[590svh]")}
    >
      <SectionRule />
      <h1 className="sr-only">Хөгжлийн төлөөх хөдөлгүүр бүрийг тэжээнэ</h1>

      <div
        ref={stageRef}
        className={cn(
          "overflow-hidden",
          isReduced ? "relative h-svh" : "sticky top-0 h-svh",
        )}
      >
        <RoadScene
          enter={enter}
          drive={drive}
          kmh={kmh}
          fade={instruments}
          settled={isReduced}
        />
        <StatementLayer exit={exit} />
      </div>

      {/* Under reduced motion the two never overlap: the sentence holds one
          screen and the road stands still on the next. */}
      {isReduced && (
        <div className="relative h-svh overflow-hidden">
          <RoadScene enter={1} drive={drive} kmh={0} settled />
        </div>
      )}
    </section>
  );
}
