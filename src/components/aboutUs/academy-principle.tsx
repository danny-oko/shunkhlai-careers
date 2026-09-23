import * as React from "react";

import {
  academyFigures,
  developmentShares,
  developmentSum,
} from "@/lib/culture";
import { cn } from "@/lib/utils";

/**
 * A colour per share, and the same one on the band as on the number.
 *
 * The band carries no words - it is the proportion itself - so colour is the
 * only thing tying a segment to the paragraph that explains it.
 *
 * All three are read on the ink ground of <StatementBands>, which is the only
 * place these panels are shown, so they are picked against that and not
 * against the page. `--brand-blue` would have been the obvious second: on ink
 * it is 1.6:1, which is a rule nobody can see. Orange, then white, then a
 * muted white is a hierarchy as well as a set - the biggest share takes the
 * brand colour and the other two step back - and the three clear 4.4:1, 17:1
 * and 3.9:1 in turn, against the 3:1 a rule and a figure this size have to
 * hold.
 *
 * Read by position, wrapped: three shares is what the policy has and what the
 * layout is drawn for, but a fourth added upstream should come out the wrong
 * colour rather than reading past the end of this array and taking the page
 * down with it.
 */
const TONE = [
  { bar: "bg-brand", text: "text-brand" },
  { bar: "bg-ink-foreground", text: "text-ink-foreground" },
  { bar: "bg-white/45", text: "text-ink-muted" },
];

/**
 * Хөгжлийн 70/20/10 зарчим - the policy drawn at the size it claims.
 *
 * The band is one row split by the shares themselves - `flex-grow` off the
 * same numbers the cards print - so the seventy is seven times the ten on
 * screen because it is seven times the ten in the policy, and it cannot drift
 * from the copy beside it the way a hand-drawn chart would.
 *
 * The three paragraphs are an even grid underneath rather than columns of the
 * same widths as the band: at 10% of the measure a column is about 115px, and
 * a paragraph set in it is a word a line. Proportion is the band's job and
 * reading is theirs.
 *
 * Both panels are laid out to a screen rather than to a page: they are shown
 * inside a pinned window, so nothing here may run past the fold. That is why
 * the standfirst is held back until `md` - it is a summary of the three
 * paragraphs under it, and on a phone the three paragraphs are what the screen
 * has room for - and why the figures are a panel of their own.
 */
export function PrinciplePanel({
  className,
  style,
  inert,
}: {
  className?: string;
  style?: React.CSSProperties;
  inert?: boolean;
}) {
  return (
    <div
      inert={inert}
      style={style}
      className={cn(
        "mx-auto w-full max-w-6xl px-6 text-ink-foreground lg:px-10",
        className,
      )}
    >
      {/* No label over the heading. The heading names the thing, the section
          it arrives in is the company speaking, and a kicker above it was one
          line of scaffolding between the two. */}
      <h2 className="type-section font-semibold tracking-[-0.02em]">
        Сургалт хөгжлийн зарчим 70/20/10
      </h2>
      <p className="mt-5 hidden max-w-2xl type-lead text-ink-muted text-pretty md:block">
        Сургалт, хөгжлийн бодлого нь ажилтныг зөвхөн сургалтад хамруулах бус,
        ажлын бодит туршлага, хамтын суралцах үйл явц, системтэй сургалтыг
        хослуулан хөгжүүлэхэд чиглэдэг.
      </p>

      {/* Decorative: every share it draws is printed as a number on the card
          under it, so there is nothing here for a reader who cannot see it to
          miss. */}
      <div aria-hidden className="mt-8 flex h-2.5 gap-1.5 md:mt-10">
        {developmentShares.map((share, index) => (
          <div
            key={share.share}
            style={{ flexGrow: share.share }}
            className={cn("rounded-full", TONE[index % TONE.length].bar)}
          />
        ))}
      </div>

      <dl className="mt-7 grid gap-6 md:mt-9 md:grid-cols-3 md:gap-10">
        {developmentShares.map((share, index) => (
          // Baseline-aligned on a phone, where the figure and the name share a
          // line because three stacked pairs would not fit the window; the
          // grid gives each its own line back from `md`.
          <div
            key={share.share}
            className="flex flex-wrap items-baseline gap-x-4 md:block"
          >
            {/* `tabular-nums` for the same reason the landing figures take it:
                three numbers read as one set only if the digits are the same
                width in all of them. */}
            <dt
              className={cn(
                "type-figure font-semibold tracking-[-0.04em] tabular-nums",
                TONE[index % TONE.length].text,
              )}
            >
              {share.share}%
            </dt>
            <dd className="md:mt-3">
              <p className="type-title font-medium tracking-[-0.01em] text-balance">
                {share.title}
              </p>
              <p className="mt-2 type-copy text-ink-muted text-pretty md:mt-3">
                {share.body}
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * What the principle produced: the write-up's own 2026 totals.
 *
 * A panel of its own rather than a block under the one above, because the two
 * together are more than a phone screen holds. It opens on the line the
 * write-up closes the principle with, which is the only place the three shares
 * are added up.
 *
 * Set in the page's own colours, not the ink ones the principle above takes:
 * this lands at the end of <CultureSection>, on whatever ground the theme has
 * given that section, and `--foreground` is the only white that is also black
 * when the page is.
 */
export function FiguresPanel({
  className,
  style,
  inert,
}: {
  className?: string;
  style?: React.CSSProperties;
  inert?: boolean;
}) {
  return (
    <div
      inert={inert}
      style={style}
      className={cn("mx-auto w-full max-w-6xl px-6 lg:px-10", className)}
    >
      <p className="border-y border-foreground/15 py-6 text-center type-section font-semibold tracking-[-0.02em] text-balance">
        {developmentSum}
      </p>

      <h2 className="mt-block type-eyebrow font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Хөгжил тоон үзүүлэлтээр · 2026
      </h2>

      <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-7 lg:grid-cols-4">
        {academyFigures.map((figure) => (
          <div key={figure.label}>
            <dt className="type-figure font-semibold tracking-[-0.04em] tabular-nums">
              {figure.value}
            </dt>
            <dd className="mt-2 type-copy text-muted-foreground text-pretty">
              {figure.label}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
