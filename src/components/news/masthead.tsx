import Image from "next/image";

import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";

/**
 * The newsroom's page header, built to <CareersHero>'s pattern.
 *
 * It was a broadsheet nameplate once, then a plain heading on the page's own
 * white, then the wing facets. It is now what the careers screen is: one
 * photograph at its own 3:2, with the heading, the brandbook's кант and the
 * line saying what the page is sitting inside it. The two headers stay the
 * same piece of furniture with different words in it.
 *
 * The date went long ago. A newspaper prints today's date because the edition
 * is of a day; an index rebuilt on every request is not, and each story
 * carries its own dateline anyway.
 */

/**
 * Unlike the careers photograph, this one has no empty corner to write in -
 * it is a room with five people in it, and every part of the frame is doing
 * something. So the wash here is not a touch-up but the ground the words are
 * given: strongest in the corner they occupy, over the floor and the chair
 * base, and gone before it reaches the faces. The two shapes are the same pair
 * the careers hero uses - an ellipse pinned to the corner for a wide frame,
 * and a masked vertical fade for a narrow one, where the same words are a much
 * taller block.
 */
const CORNER_SCRIM =
  "radial-gradient(92% 78% at 0% 100%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.88) 42%, rgba(255,255,255,0) 78%)";
const COLUMN_SCRIM =
  "linear-gradient(to top, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 36%, rgba(255,255,255,0) 62%)";
const COLUMN_MASK =
  "linear-gradient(to right, black 0%, black 46%, transparent 76%)";

export function Masthead() {
  return (
    <header className="relative isolate overflow-hidden border-b border-border">
      {/* The careers screen's measure to the pixel: the bare max-w-6xl column,
          so the frame sits on the same edges as the desks and the grid under
          it, and the words inside it on the same 40px gutter as their text. */}
      <div className="mx-auto max-w-6xl">
        <div className="@container relative aspect-[3/2] overflow-hidden">
          <Image
            src="/brand/news-hero.jpg"
            alt="Шунхлайн ажилтнууд оффисын амралтын өрөөнд буйдан дээр суун ярилцаж байна."
            fill
            // The masthead picture is the page's largest paintable element.
            preload
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover object-center"
          />

          <div
            aria-hidden
            className="absolute inset-0 sm:opacity-80 lg:hidden"
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

          <div className="absolute inset-x-0 bottom-0 w-[56%] pb-[6%] pl-[6%] sm:w-[50%] lg:w-[46%] lg:pl-10">
            <Rise delay={90}>
              {/* The careers heading's own class list, not the newsroom's
                  `news-headline`. Both set the site's sans - `[data-newsroom]`
                  changes two colour tokens and no type - but `news-headline` is
                  700 where the careers heading is 600. Shared classes cannot
                  drift again. */}
              <h1 className="text-[clamp(1rem,4.1cqw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance text-ink">
                Мэдээ, мэдээлэл
              </h1>
            </Rise>

            <Rise delay={180} className="mt-[1.7cqw]">
              <GradientRule className="w-[10cqw] max-w-[7rem] min-w-[2.5rem] rounded-full" />
            </Rise>

            <Rise delay={260} className="mt-[1.7cqw]">
              <p className="text-[clamp(0.6rem,1.5cqw,1rem)] leading-[1.45] text-pretty text-ink/75">
                Компанийн салбар нэгжүүд болон хүний нөөцийн мэдээлэл.
              </p>
            </Rise>
          </div>
        </div>
      </div>
    </header>
  );
}
