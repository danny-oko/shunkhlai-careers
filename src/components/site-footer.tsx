import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-logo";
import { DotWordmark } from "@/components/brand/dot-wordmark";
import { GradientRule } from "@/components/brand/gradient-rule";
import { SectionRule } from "@/components/brand/section-rule";

/** The label over each column of the footer. */
const HEADING =
  "text-[0.8125rem] font-medium tracking-[0.12em] text-muted-foreground uppercase";

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
      { href: "/about#history", label: "Бидний түүх" },
      { href: "/about", label: "Бидний тухай" },
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

export function SiteFooter() {
  return (
    <footer className="relative bg-secondary/40">
      <SectionRule />
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        {/* Four equal columns left the whitespace lopsided: the lists are much
            shorter than the brand and contact blocks, so the slack all piled up
            on the right (53px, 128px, then 180px between them). Sized to their
            content and spread instead, the four sit on even gaps. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:flex lg:justify-between">
          <div>
            <BrandLockup className="h-20" sizes="132px" />
            <GradientRule className="mt-4 max-w-[5rem] rounded-full" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Хөдөлмөр - хөгжлийн хөдөлгүүр. 1993 оноос хойш Монгол улсын эрчим
              хүч, логистикийн дэд бүтцийг бүтээж байна.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className={HEADING}>{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-brand"
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
                <li key={item.value} className="text-sm wrap-break-word">
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

        <div className="mt-12 flex flex-col gap-2 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Шунхлай ХХК
          </p>
          <p className="text-sm text-muted-foreground">
            Капитал Хаус, Чингисийн өргөн чөлөө 48/1, Улаанбаатар-36
          </p>
        </div>
      </div>

      {/* Same container as everything above it, so the mark starts and ends on
          the same line as the columns and the copyright rather than running to
          the edge of the window. Quiet, but in the brand's own orange rather
          than the page's ink at a tenth: the mark is drawn as scattered dots,
          not a solid, so only a fraction of each cell is inked and a tint that
          reads as faint on a solid shape disappears altogether here.
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
          className="block w-full text-brand/25 sm:hidden dark:text-brand/35"
        />
        <DotWordmark
          text="ШУНХЛАЙ ХХК"
          className="hidden w-full text-brand/25 sm:block dark:text-brand/35"
        />
      </div>
    </footer>
  );
}
