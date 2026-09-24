"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useReducedMotion } from "@/components/landing/use-scroll-progress";
import { StoryCard } from "@/components/news/story-card";
import type { NewsArticle } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/** How long each card is left in place before the rail moves on. */
const AUTOPLAY_MS = 5000;

/**
 * The stories under the lead, as a row the reader moves through.
 *
 * It used to carry itself past the reader as a marquee. A story that is
 * walking away while you read its headline has to be chased, so it now moves
 * a whole card at a time and then stands: on its own every few seconds, and
 * whenever asked - the arrows step it, and a swipe or a trackpad push does
 * the same through the native scroll.
 *
 * A scroll container with snap points rather than a carousel library, for the
 * reason <PhotoRun> in the sphere gallery gives: every gesture already does
 * the right thing to one, and where it is at is read back off the scroll
 * rather than kept as state the gestures have to report.
 */
export function StoryRail({ articles }: { articles: NewsArticle[] }) {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });

  const measure = React.useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    // A pixel of slack either way: snapping can land a fraction short.
    setEdges({
      start: strip.scrollLeft <= 1,
      end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
    });
  }, []);

  React.useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === "undefined") return;
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(strip);
    return () => watch.disconnect();
  }, [measure]);

  const step = React.useCallback((direction: -1 | 1) => {
    const strip = stripRef.current;
    const card = strip?.firstElementChild as HTMLElement | null;
    if (!strip || !card) return;
    // One card and the gap after it, so each press lands on the next snap.
    const gap = parseFloat(getComputedStyle(strip).columnGap) || 0;
    strip.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: "smooth",
    });
  }, []);

  // It also moves on its own, a card at a time, and goes back to the first
  // from the last. It is held while the reader is on it - a pointer over it,
  // a finger on it, or the keyboard inside it - so nothing walks away from
  // the headline being read, and it never moves for anyone who has asked for
  // less motion or while the tab is out of sight.
  const isReduced = useReducedMotion();
  const held = React.useRef(false);

  React.useEffect(() => {
    if (isReduced) return;
    const tick = window.setInterval(() => {
      const strip = stripRef.current;
      if (!strip || held.current || document.hidden) return;
      if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1) {
        strip.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        step(1);
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(tick);
  }, [isReduced, step]);

  return (
    <div
      className="relative"
      onPointerEnter={() => (held.current = true)}
      onPointerLeave={() => (held.current = false)}
      onTouchStart={() => (held.current = true)}
      onTouchEnd={() => (held.current = false)}
      onFocus={() => (held.current = true)}
      onBlur={(event) => {
        // Only once focus has left the rail, not on a move between its cards.
        if (!event.currentTarget.contains(event.relatedTarget)) held.current = false;
      }}
    >
      <div
        ref={stripRef}
        onScroll={measure}
        className="flex snap-x snap-mandatory gap-7 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {articles.map((article) => (
          <StoryCard
            key={article.id}
            article={article}
            className="w-[17.5rem] shrink-0 snap-start sm:w-[21rem]"
            sizes="(min-width: 640px) 21rem, 17.5rem"
          />
        ))}
      </div>

      {/* Either side of the row, on the middle of the covers: a cover is
          3:2, so its middle is a third of the card's width down. From `sm`
          they sit astride the row's edge, half in the page's gutter; on a
          phone there is no gutter to spare, so they come in over the picture.
          Over a picture they need a ground of their own, hence the solid plate
          and the shadow. One with nowhere to go is taken away rather than
          dimmed, since a dim disc over a photograph reads as part of it. */}
      {[
        { to: -1 as const, off: edges.start, Icon: ChevronLeft, label: "Өмнөх мэдээ", side: "left-2 sm:left-0 sm:-translate-x-1/2" },
        { to: 1 as const, off: edges.end, Icon: ChevronRight, label: "Дараах мэдээ", side: "right-2 sm:right-0 sm:translate-x-1/2" },
      ].map(({ to, off, Icon, label, side }) => (
        <button
          key={label}
          type="button"
          onClick={() => step(to)}
          disabled={off}
          aria-label={label}
          className={cn(
            "absolute top-[calc(17.5rem/3)] z-10 grid size-9.5 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-foreground shadow-[0_6px_18px_-8px_rgb(0_0_0/0.35)] transition-[color,border-color,opacity] duration-200 outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0 motion-reduce:transition-none sm:top-28",
            side,
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
