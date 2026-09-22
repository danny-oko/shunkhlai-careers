import { FeatherOrnament } from "@/components/news/feather-ornament";

/**
 * The newsroom's page header.
 *
 * It was a broadsheet nameplate: a folio line of small caps, the paper's name
 * set across the full measure, a strapline between two printer's ornaments and
 * a thick-over-hairline rule closing it off. Every one of those is a thing a
 * newspaper does and a company does not, and together they were most of why
 * the page read as a paper rather than as part of this site.
 *
 * What replaces them is what a corporate newsroom actually puts at the top of
 * its index: who is speaking, what the page is, one sentence saying what is on
 * it. Left-aligned on the site's own measure, so the heading starts on the
 * line the stories under it start on.
 *
 * The date went with the folio line. A newspaper prints today's date because
 * the edition is of a day; an index that is rebuilt on every request is not,
 * and each story carries its own dateline anyway.
 *
 * The feather survives the cut, enlarged and dropped to a watermark. As a
 * pair flanking the strapline it was a printer's fleuron and read as one more
 * newspaper habit; at this size it is what the rest of the site does with the
 * motif - a quiet brand mark on a header, not an ornament on a line.
 */
export function Masthead() {
  return (
    <header className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      />

      {/* Hidden below `lg`: the mark sits in the margin beside the heading,
          and on a narrower window the container runs the full width and there
          is no margin for it to sit in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
      >
        <FeatherOrnament className="news-ornament absolute -top-8 right-[5%] size-44 opacity-[0.07]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:py-20 lg:px-10">
        <p className="news-kicker">Шунхлай ХХК</p>

        <h1 className="news-headline mt-3 type-figure">Мэдээ</h1>

        <p className="mt-4 max-w-xl type-lead text-muted-foreground">
          Компанийн сурвалжилга, салбарын мэдээ, хүний нөөцийн шинэчлэл.
        </p>
      </div>
    </header>
  );
}
