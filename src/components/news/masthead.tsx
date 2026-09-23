import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";
import { WingFacets } from "@/components/brand/wing-facets";

/**
 * The newsroom's page header, built to <CareersHero>'s pattern.
 *
 * It was a broadsheet nameplate once, then a plain heading on the page's own
 * white. Neither looked like the rest of the site: the careers screen opens on
 * the wing facets with a kicker, a heading, the brandbook's кант and one line
 * saying what the page is, and that is the shape a top-level section of this
 * site has. This is that shape with the newsroom's own words in it.
 *
 * Two grounds, as there: the facets are the picture and the lattice is the
 * texture over them. The feather watermark that used to sit in the right
 * margin went with the change - the facets are already the brand mark on this
 * header, and two of them in one corner read as clutter.
 *
 * The date went long ago. A newspaper prints today's date because the edition
 * is of a day; an index rebuilt on every request is not, and each story
 * carries its own dateline anyway.
 */
export function Masthead() {
  return (
    <header className="relative isolate overflow-hidden border-b border-border">
      <WingFacets className="-z-20" />

      <FeatherLattice
        className="-z-10 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_20%,transparent_100%)]"
        tone="brand"
      />

      {/* The careers screen's measure and rhythm to the pixel, so the two
          headers are the same piece of furniture with different words. */}
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 lg:px-10">
        <Rise delay={90}>
          {/* The careers heading's own class list, not the newsroom's
              `news-headline`. Both set the site's sans - `[data-newsroom]`
              changes two colour tokens and no type - but `news-headline` is
              700 where the careers heading is 600, and it carried an `mt-5`
              from the kicker that used to sit over it. Twenty pixels lower
              and a weight heavier is exactly how far apart the two headers
              read. Shared classes cannot drift again. */}
          <h1 className="max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            Мэдээ, мэдээлэл
          </h1>
        </Rise>

        <Rise delay={180} className="mt-10">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Rise>

        <Rise delay={260}>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Компанийн салбар нэгжүүдийн мэдээ, мэдээлэл болон хүний нөөцийн
            шинэчлэл.
          </p>
        </Rise>
      </div>
    </header>
  );
}
