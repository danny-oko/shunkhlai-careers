"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

import { heroSlides } from "@/components/landing/hero-slides";
import { HeroOverlay } from "@/components/landing/hero-overlay";
import { useScrollProgress } from "@/components/landing/use-scroll-progress";
import { cn } from "@/lib/utils";

const SLIDE_MS = 6500;
/** Share of the scroll runway the frame takes to finish opening. */
const OPEN_AT = 0.62;

/**
 * The hero: campaign footage that opens out of a card into the full viewport
 * as the page is scrolled, with the headline riding in front of it.
 *
 * The section is a tall runway; its only child is pinned to the viewport for
 * the length of it. Frame inset and corner radius are driven off how far
 * through that runway the reader is, so the growth tracks the scroll exactly
 * rather than playing as a fixed-length animation.
 */
export function HeroStage({ roleCount }: { roleCount: number }) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const { progress, isReduced } = useScrollProgress(sectionRef);
  /**
   * Which slide is showing and which one it replaced.
   *
   * The pair is the whole fix for the smear the crossfade used to leave. Both
   * layers were fading at once - the old one out, the new one in - so halfway
   * through, each was at about half opacity and the screen showed a blend of
   * two photographs. That blend is what reads as lag: nothing is moving badly,
   * there are simply two pictures on screen at once for most of a second.
   *
   * Knowing the outgoing slide means it can be left alone. It stays fully
   * opaque underneath while the incoming one fades in on top of it, so there
   * is only ever one photograph visible plus one arriving over it, and the
   * ground never shows through between them.
   */
  const [shown, setShown] = React.useState({ active: 0, previous: 0 });
  const active = shown.active;

  const show = React.useCallback(
    (next: number) =>
      setShown((current) =>
        next === current.active
          ? current
          : { active: next, previous: current.active },
      ),
    [],
  );

  React.useEffect(() => {
    if (isReduced) return;
    const timer = window.setInterval(
      () => setShown((current) => ({
        active: (current.active + 1) % heroSlides.length,
        previous: current.active,
      })),
      SLIDE_MS,
    );
    return () => window.clearInterval(timer);
  }, [isReduced]);

  // easeOutCubic: most of the opening happens early, then it settles.
  const opened = Math.min(progress / OPEN_AT, 1);
  const eased = 1 - Math.pow(1 - opened, 3);
  const closed = 1 - eased;

  return (
    <section
      ref={sectionRef}
      aria-label="Шунхлай - Хүчирхэг монголын хөгжлийн хүрд"
      className={cn("relative", isReduced ? "h-svh" : "h-[150svh]")}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <div
          className="absolute overflow-hidden bg-ink"
          style={{
            top: `${closed * 11}svh`,
            bottom: `${closed * 11}svh`,
            left: `${closed * 4}vw`,
            right: `${closed * 4}vw`,
            borderRadius: `${closed * 28}px`,
          }}
        >
          {heroSlides.map((item, index) => (
            <div
              key={item.src}
              aria-hidden={index !== active}
              className={cn(
                "absolute inset-0",
                // Only the arriving slide animates. The one it covers holds at
                // full opacity, and the third is dropped instantly - it is
                // behind two opaque layers, so fading it would be a second of
                // compositing nobody can see.
                index === active
                  ? "z-20 opacity-100 transition-opacity duration-700 ease-in-out"
                  : index === shown.previous
                    ? "z-10 opacity-100"
                    : "z-0 opacity-0",
              )}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                // The hero footage is the page's largest paintable element, so
                // the first frame is preloaded. The other two are only told not
                // to wait: lazily loaded, a slide began decoding at the moment
                // it was asked to appear, and the fade ran over a frame that
                // was not there yet - which looked like the outgoing picture
                // hanging around rather than the incoming one being late.
                priority={index === 0}
                loading={index === 0 ? undefined : "eager"}
                sizes="100vw"
                // Filled at every size. Letterboxing phones kept the campaign
                // lockup whole but left most of a portrait screen empty, which
                // read as dead space rather than as design.
                className="brand-kenburns object-cover object-center"
                // Three continuous transform animations run whether or not
                // their slide is on screen. The hidden two are frozen where
                // they stand rather than restarted, which would snap them back
                // to the start of the pan the moment they were shown.
                style={{
                  animationPlayState: index === active ? "running" : "paused",
                }}
              />
            </div>
          ))}

          {/* Holds the headline legible over all three photographs.

              Both this and the overlay under it are lifted above the slides
              rather than left to DOM order. The slides carry their own
              z-index - which is what keeps the arriving one over the one it
              replaces - and a positioned element with a z-index paints above
              every `auto` one on the layer whatever the order in the markup.
              Left at `auto`, the photograph covered the headline, both
              buttons and the slide dots. */}
          <div className="absolute inset-x-0 bottom-0 z-30 h-3/5 bg-linear-to-t from-black/80 via-black/45 to-transparent" />

          <HeroOverlay
            slide={heroSlides[active]}
            active={active}
            roleCount={roleCount}
            onSelect={show}
          />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center text-white/80"
          style={{ opacity: closed }}
        >
          <ChevronDown className="brand-cue size-5" />
        </div>
      </div>
    </section>
  );
}
