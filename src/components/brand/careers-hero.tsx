"use client";

import * as React from "react";
import Image from "next/image";

import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";
import { cn } from "@/lib/utils";

/**
 * The two pictures the hero alternates between, and what each one leaves the
 * words.
 *
 * They are opposites, which is why the slide carries the layout rather than
 * the section: the crosswalk photograph is paper white with an empty corner
 * and takes the whole block; the campaign key visual is a full orange field
 * with its own lockup across the middle and a walker under it, so the only
 * clear ground on it is the top fifth. The heading and the line under it fit
 * there; the rule and the paragraph do not, and are faded out for its turn
 * rather than laid over the lettering.
 */
const SLIDES = [
  {
    src: "/brand/careers-hero.jpg",
    alt: "Ажилдаа явж буй дөрвөн ажилтан явган хүний гарцаар алхаж байна. Гарцан дээр “Your career starts here” гэж бичжээ.",
    full: true,
  },
  {
    src: "/brand/careers-hero-join.jpg",
    alt: "Цагаан цамцтай эмэгтэй хоёр гараараа амаа хүрээлэн дуудаж байна. Улбар шар дэвсгэр дээр “Бидэнтэй нэгдээрэй” гэж бичжээ.",
    full: false,
  },
] as const;

const SLIDE_MS = 7000;

/**
 * The photograph's own paper white, laid back over the corner the walkers
 * leave empty. It belongs to the first slide alone - the second is a flat
 * orange ground that a white wash would only dirty - so it lives inside that
 * slide's layer and is covered along with it.
 *
 * The corner is only clean for the top third of the picture and the left half
 * of it; below that the near crosswalk band cuts diagonally across. On a wide
 * frame the text clears that band on its own and the wash is barely doing
 * anything; on a narrow one the same words are a much taller block, so the
 * wash has to carry them over the band. Hence two: an ellipse pinned to the
 * corner for the wide case, and for the narrow one a vertical fade masked off
 * to the left half, which keeps the walkers themselves clear of it.
 */
const CORNER_SCRIM =
  "radial-gradient(115% 88% at 0% 10%, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.88) 38%, rgba(255,255,255,0) 72%)";
const COLUMN_SCRIM =
  "linear-gradient(to bottom, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.94) 50%, rgba(255,255,255,0) 78%)";
const COLUMN_MASK =
  "linear-gradient(to right, black 0%, black 44%, transparent 74%)";

export function CareersHero({ roleCount }: { roleCount: number }) {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // A hero that swaps itself out is motion the reader did not ask for, so
    // under a reduced-motion setting the first slide simply stays put.
    if (query.matches) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % SLIDES.length),
      SLIDE_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const showsBlock = SLIDES[active].full;

  return (
    <section className="relative isolate overflow-hidden">
      {/* No side padding: the frame has to sit on exactly the same left and
          right edges as the job browser under it, which is the bare max-w-6xl
          column - with any inset here, the rule that opens the browser ran
          wider than the picture and the two blocks read as misaligned. */}
      <div className="mx-auto max-w-6xl">
        {/* The frame is the pictures' own 3:2 at every width, so nothing in
            them is ever cropped. The words live inside it at every width too -
            they are sized in cqw off the frame rather than off the viewport,
            so the block keeps the same share of the picture as the picture
            shrinks, and only stops shrinking at the floors in each clamp. */}
        <div className="@container relative aspect-[3/2] overflow-hidden">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.src}
              aria-hidden={index !== active}
              className={cn(
                // The first slide is the ground and never fades: with only two
                // pictures, fading both at once would put half of each on the
                // screen for most of a second, which reads as a smear rather
                // than as a change.
                "absolute inset-0 transition-opacity duration-700 ease-in-out",
                index === 0
                  ? "z-0 opacity-100"
                  : index === active
                    ? "z-10 opacity-100"
                    : "z-10 opacity-0",
              )}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                // The first frame is the page's largest paintable element; the
                // second is only told not to wait, so it is decoded before it
                // is asked to appear rather than during its own fade.
                preload={index === 0}
                loading={index === 0 ? undefined : "eager"}
                sizes="(min-width: 1024px) 1152px, 100vw"
                className="object-cover object-center"
              />

              {slide.full && (
                <>
                  <div
                    aria-hidden
                    className="absolute inset-0 sm:opacity-75 lg:hidden"
                    style={{
                      backgroundImage: COLUMN_SCRIM,
                      WebkitMaskImage: COLUMN_MASK,
                      maskImage: COLUMN_MASK,
                    }}
                  />

                  <div
                    aria-hidden
                    className="absolute inset-0 hidden lg:block"
                    style={{ backgroundImage: CORNER_SCRIM }}
                  />
                </>
              )}
            </div>
          ))}

          <div className="absolute inset-0 z-20 w-[56%] pt-[5%] pl-[6%] sm:w-[50%] lg:w-[46%] lg:pl-10 xl:pt-[7%]">
            <Rise delay={90}>
              <h1
                className={cn(
                  "text-[clamp(1rem,4.1cqw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance transition-colors duration-700",
                  // White is the campaign's own colour on that orange, and the
                  // colour its lockup is set in; the crosswalk photograph is
                  // paper, so there the words stay ink.
                  showsBlock ? "text-ink" : "text-white",
                )}
              >
                Нээлттэй ажлын байр
              </h1>
            </Rise>

            <Rise delay={180} className="mt-[1.7cqw]">
              <p
                className={cn(
                  "text-[clamp(0.68rem,1.95cqw,1.25rem)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance transition-colors duration-700",
                  // The shimmer is the brand gradient, which is the second
                  // slide's own ground - on it the line would disappear.
                  showsBlock ? "brand-shimmer" : "text-white",
                )}
              >
                Хүчирхэг монголын хөгжлийн хүрд
              </p>
            </Rise>

            <div
              className={cn(
                "transition-opacity duration-500 ease-in-out",
                showsBlock ? "opacity-100" : "opacity-0",
              )}
            >
              <Rise delay={260} className="mt-[1.7cqw]">
                <GradientRule className="w-[10cqw] max-w-[7rem] min-w-[2.5rem] rounded-full" />
              </Rise>

              <Rise delay={320} className="mt-[1.7cqw]">
                <p className="text-[clamp(0.6rem,1.5cqw,1rem)] leading-[1.45] text-pretty text-ink/75">
                  Монголыг хөдөлгөж буй эрчим хүч, тээвэр логистик, дижитал дэд
                  бүтцийг бид бүтээж, найдвартай ажиллуулдаг. Одоогоор{" "}
                  {roleCount} ажлын байр нээлттэй байна.
                </p>
              </Rise>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
