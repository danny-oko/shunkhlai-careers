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
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (isReduced) return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % heroSlides.length),
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
      aria-label="Шунхлай - Хөдөлмөр хөгжлийн хөдөлгүүр"
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
                "absolute inset-0 transition-opacity duration-1000 ease-out",
                index === active ? "opacity-100" : "opacity-0",
              )}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                // The hero footage is the page's largest paintable element.
                priority={index === 0}
                sizes="100vw"
                // Filled at every size. Letterboxing phones kept the campaign
                // lockup whole but left most of a portrait screen empty, which
                // read as dead space rather than as design.
                className="brand-kenburns object-cover object-center"
              />
            </div>
          ))}

          {/* Holds the headline legible over all three photographs. */}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/80 via-black/45 to-transparent" />

          <HeroOverlay
            slide={heroSlides[active]}
            active={active}
            roleCount={roleCount}
            onSelect={setActive}
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
