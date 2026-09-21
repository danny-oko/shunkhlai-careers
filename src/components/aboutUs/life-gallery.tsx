"use client";

import * as React from "react";
import Image from "next/image";

import { Reveal } from "@/components/reveal";
import { stories } from "@/lib/culture";
import { SectionRule } from "@/components/brand/section-rule";
import { cn } from "@/lib/utils";

/**
 * The heading already says "Бидний хамгийн…", so a claim that opens with
 * Хамгийн says it twice. One of the four does. It is the client's own copy and
 * still has to read whole wherever else it is used, so the word is dropped
 * here for display rather than edited out of culture.ts.
 */
const LEAD_IN = /^Хамгийн\s+/;

function claim(headline: string) {
  const rest = headline.replace(LEAD_IN, "");
  if (rest === headline) return headline;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * Ажилтны түүх — the four records, read as one list rather than four cards.
 *
 * The headlines stack at display size with only the pointed-at one inked in;
 * the rest hold their place in grey, so the list reads as a set of claims the
 * company is making and the eye is told which one is being answered. The
 * poster for that record stands alongside and changes with it.
 *
 * A grid of four cards said the same thing with none of the weight: four equal
 * things, none of them the subject. This has a subject at all times.
 */
export function LifeGallery() {
  const [active, setActive] = React.useState(0);

  return (
    <section
      id="life"
      className="relative scroll-mt-20 bg-ink py-section text-ink-foreground"
    >
      <SectionRule />
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        {/* Centred, not top-aligned: the poster belongs to the list as a
            whole, not to whichever claim happens to be first. The heading sits
            inside the left column rather than over both, which is what makes
            the two columns close enough in height for centring to read as
            centring — over the top it left the poster taller by half a screen
            and the list pushed down into the middle of nowhere. */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <Reveal>
            {/* `type-eyebrow`, not `type-kicker`: this label was already set at
                13px and the kicker step floors at 11, so the denser role would
                have made it smaller on a phone than it is today. */}
            <p className="type-eyebrow font-medium tracking-[0.14em] text-ink-muted uppercase">
              Ажилтны түүх · Life at Shunkhlai
            </p>
            <h2 className="mt-5 type-section font-semibold tracking-[-0.02em]">
              Бидний хамгийн…
            </h2>

            <ul className="mt-10">
              {stories.map((item, index) => (
                <li key={item.src} className="border-b border-white/12 last:border-b-0">
                  {/* Hover is the gesture the design is built around, but it is
                      not the only one: focus does the same thing so the list
                      can be tabbed, and click so it works on a touch screen,
                      where there is no hover to give. */}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onClick={() => setActive(index)}
                    // The visible text is the claim; the name behind it is only
                    // drawn beside the poster, so it is spelled out here rather
                    // than left to whoever cannot see which poster is up.
                    aria-label={`${claim(item.headline)} - ${item.name}, ${item.role}`}
                    className={cn(
                      "block w-full py-4 text-left type-section leading-[1.15] font-semibold tracking-[-0.03em] text-balance transition-colors duration-300 outline-none motion-reduce:transition-none",
                      "focus-visible:text-brand",
                      index === active ? "text-ink-foreground" : "text-ink-foreground/30",
                    )}
                  >
                    {claim(item.headline)}
                  </button>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            {/* One frame at the shape three of the four posters were drawn in,
                and the fourth cropped into it. Letting the box change shape
                instead left that one poster sitting alone at a size nothing
                else on the page shared, and reserving the tallest shape for it
                only moved the problem into the empty space underneath.

                Cropping it costs nothing here: what falls outside the 4:5 is
                the headline and the paragraph printed into the artwork, and
                both of those are already on this page as live text — the claim
                in the list, the paragraph in the caption. Three of the four are
                already 4:5, so for them the cover is not a crop at all. */}
            <figure>
              <div className="relative aspect-[1080/1350] overflow-hidden rounded-2xl bg-white/5">
                {stories.map((item, index) => (
                  <Image
                    key={item.src}
                    src={item.src}
                    alt={index === active ? item.alt : ""}
                    aria-hidden={index !== active}
                    fill
                    sizes="(max-width: 1024px) 100vw, 24rem"
                    style={{ objectPosition: item.focus }}
                    className={cn(
                      "object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none",
                      index === active ? "opacity-100" : "opacity-0",
                    )}
                  />
                ))}
              </div>

              {/* Stacked for the same reason the posters are: the four records
                  do not run to the same length, and letting the caption set
                  its own height moved the row — and the list opposite it —
                  by a line every time the pointer crossed a shorter one. All
                  four are laid over each other, so the block is as tall as the
                  longest of them whichever one is showing. */}
              <figcaption className="mt-6 grid">
                {stories.map((item, index) => (
                  <div
                    key={item.src}
                    aria-hidden={index !== active}
                    className={cn(
                      "[grid-area:1/1] transition-opacity duration-300 ease-out motion-reduce:transition-none",
                      index === active ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <p className="text-base font-medium tracking-[-0.01em]">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {item.role}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">
                      {item.highlight}
                    </p>
                  </div>
                ))}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
