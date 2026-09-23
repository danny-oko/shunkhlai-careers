import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-logo";
import { DotWordmark } from "@/components/brand/dot-wordmark";
import { GradientRule } from "@/components/brand/gradient-rule";
import { SectionRule } from "@/components/brand/section-rule";
import { cn } from "@/lib/utils";

const HEADING =
  "type-eyebrow font-medium tracking-[0.12em] text-muted-foreground uppercase";

/**
 * One row of any of the three lists.
 *
 * On the `li`, not on the link inside it. The two link columns used to put
 * `text-sm` on the anchor and leave the `li` to inherit the body's 24px line,
 * while the contact column put it on the `li` and got 20px — so the same
 * 14px type stepped 34px in two columns and 30px in the third, three lists
 * side by side on two different rhythms.
 */
const ROW = "text-sm";

const columns = [
  {
    title: "Карьер",
    links: [
      { href: "/careers", label: "Нээлттэй ажлын байр" },
      { href: "/about#academy", label: "Сургалт, хөгжил" },
      { href: "/about#benefits", label: "Хөнгөлөлт, хангамж" },
      { href: "/about#clubs", label: "Хобби клубууд" },
    ],
  },
  {
    title: "Компани",
    links: [
      { href: "/news", label: "Мэдээ, сурвалжилга" },
      { href: "/about#history", label: "Бидний түүх" },
      // The statements, not the top of the page. "Бидний тухай" is the name of
      // the whole page, so it had been pointing at all of it and landing on
      // the history timeline - which the link above it already goes to. The
      // mission is the first of the three statements and `#mission` is the
      // scroll position that shows it.
      { href: "/about#mission", label: "Бидний тухай" },
      { href: "/about#life", label: "Ажилтны түүх" },
    ],
  },
];

/**
 * Content plan 8 — Холбоо барих.
 *
 * The plan gave the social handles but no addresses. The Facebook page is the
 * one whose own listing gives the Capital House address printed at the foot of
 * this page, so it is the company's and not a namesake's; the Instagram address
 * is the handle itself, which is all an instagram.com/<handle> URL is.
 */
const contact: Array<{ label: string; value: string; href?: string }> = [
  { label: "Утас", value: "+976 7007-3003", href: "tel:+97670073003" },
  {
    label: "Facebook",
    value: "Shunkhlai HR",
    href: "https://www.facebook.com/ShunkhlaiHR",
  },
  {
    label: "Instagram",
    value: "Shunkhlai_jobs",
    href: "https://www.instagram.com/shunkhlai_jobs/",
  },
];

/** The registered office, as it is printed at the foot of the page. */
const OFFICE = "Капитал Хаус, Чингисийн өргөн чөлөө 48/1, Улаанбаатар-36";

/**
 * The company's own Google Maps listing - Шунхлай ХХК, at 47.8986222,
 * 106.9027632.
 *
 * The listing, not a search for the address above it. Searching was tried
 * first and was wrong: handed the printed address, Maps answers with a Capital
 * House at 47.9144669, 106.9155284, which is two kilometres from where the
 * company actually is. The address as printed and the place as pinned are not
 * the same thing, and only the second of them can be linked to reliably.
 *
 * `cid` is that listing's own id - `0x126a828b13a3ad7` in the hex Maps writes
 * into its URLs, in decimal here because that is the form `?cid=` takes. It
 * opens the company's card rather than a dropped pin, and it keeps working if
 * the wording of the address ever changes.
 */
const OFFICE_MAP = "https://www.google.com/maps?cid=82938535878474455";

export function SiteFooter() {
  return (
    <footer className="relative bg-secondary/40">
      <SectionRule />
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        {/* The mark stands above the columns rather than inside the first of
            them. In the column it was 119px of artwork sitting where the other
            three put a heading, so the description under it began a hundred
            pixels below the first link in every other list and no two columns
            started on the same line. Lifted out, the row below it holds four
            things that all begin with type, and they begin together. */}
        <BrandLockup className="h-20" sizes="132px" />
        <GradientRule className="mt-3 max-w-20 rounded-full" />

        {/* Four equal columns left the whitespace lopsided: the lists are much
            shorter than the brand and contact blocks, so the slack all piled up
            on the right (53px, 128px, then 180px between them). Sized to their
            content and spread instead, the four sit on even gaps.

            Pulled up rather than merely un-spaced. The sentence has to carry a
            heading's worth of blank above it to stay on the line the links
            start on, so on its own that blank is a floor the gap under the
            rule cannot go below - 53px, most of it invisible. Lifting the
            whole row instead moves the labels and the sentence together, so
            the alignment survives and the rule closes up on the sentence. The
            labels end up level with the foot of the lockup, which costs
            nothing: they are three columns away from it and there is nothing
            above them. Only from `sm` - stacked, there is nothing to pull up
            to. */}
        <div className="mt-5 grid gap-10 sm:-mt-6 sm:grid-cols-2 lg:flex lg:justify-between">
          <div>
            {/* A heading's worth of space, drawn in a heading so it is exactly
                that and stays exactly that: the label is fluid, so any number
                written here instead would be right at one window width and
                wrong at every other. The sentence below then starts on the
                line the first link of every other column starts on - which is
                what the eye reads as the columns beginning together, not the
                labels above them. Kept out of the flow below `sm`, where the
                columns stack and there is nothing beside it to line up with. */}
            <p className={cn(HEADING, "invisible hidden sm:block")} aria-hidden>
              &nbsp;
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground sm:mt-4">
              Хөдөлмөр - хөгжлийн хөдөлгүүр. 1993 оноос хойш Монгол улсын эрчим
              хүч, логистикийн дэд бүтцийг бүтээж байна.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className={HEADING}>{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label} className={ROW}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* A column of its own rather than a tail on the brand block: as a
              tail it ran the left side twice as long as the link columns and
              left the right half of the footer empty. */}
          <div>
            <p className={HEADING}>Холбоо барих</p>
            <ul className="mt-4 space-y-2.5">
              {contact.map((item) => (
                <li key={item.value} className={cn(ROW, "wrap-break-word")}>
                  <span className="text-muted-foreground">{item.label}: </span>
                  {item.href ? (
                    <a
                      href={item.href}
                      // tel: and mailto: hand off to another app; the social
                      // pages are the only ones that leave for another site.
                      {...(item.href.startsWith("https://")
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                      className="transition-colors hover:text-brand"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <span>{item.value}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-x-8">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Шунхлай ХХК. Бүх эрх хуулиар
            хамгаалагдсан.
          </p>
          <a
            href={OFFICE_MAP}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground transition-colors hover:text-brand"
          >
            {OFFICE}
          </a>
        </div>
      </div>

      {/* Same container as everything above it, so the mark starts and ends on
          the same line as the columns and the copyright rather than running to
          the edge of the window. Quiet, but in the brand's own orange rather
          than the page's ink at a tenth: the mark is drawn as scattered dots,
          not a solid, so only a fraction of each cell is inked and a tint that
          reads as faint on a solid shape disappears altogether here.

          That fraction is the whole of why these numbers are as high as they
          are. A dot of 0.26 of the pitch covers about a fifth of its cell, so
          whatever alpha is asked for here is spent over a fifth of the area:
          at a quarter, which is where this started, the mark carried about 5%
          ink and was not so much quiet as absent. These land nearer 13%, which
          is a tint you can see without it competing with the columns above it.
          The dark ground takes a little more of it than the light one, which
          is the usual asymmetry — light marks on dark read stronger.

          Two cuts, because the whole drawing scales with its box and the dots
          go with it. On a phone the eleven-glyph version would be set so small
          that the grid closes up into a smear, so the narrow one drops the ХХК
          — fewer letters, larger type — and coarsens the screen to match. */}
      <div className="mx-auto max-w-6xl px-6 pb-6 lg:px-10">
        <DotWordmark
          text="ШУНХЛАЙ"
          id="dot-wordmark-screen-sm"
          pitch={0.04}
          className="block w-full text-brand/60 sm:hidden dark:text-brand/70"
        />
        <DotWordmark
          text="ШУНХЛАЙ ХХК"
          className="hidden w-full text-brand/60 sm:block dark:text-brand/70"
        />
      </div>
    </footer>
  );
}
