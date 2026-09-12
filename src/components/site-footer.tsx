import Link from "next/link";

import { DotWordmark } from "@/components/brand/dot-wordmark";
import { GradientRule } from "@/components/brand/gradient-rule";
import { SectionRule } from "@/components/brand/section-rule";

const columns = [
  {
    title: "Карьер",
    links: [
      { href: "/careers", label: "Нээлттэй ажлын байр" },
      { href: "/about", label: "Бидний тухай" },
      { href: "/about#academy", label: "Сургалт, хөгжил" },
      { href: "/about#benefits", label: "Хөнгөлөлт, хангамж" },
    ],
  },
  {
    title: "Компани",
    links: [
      { href: "/about#history", label: "Бидний түүх" },
      { href: "/about#values", label: "Үнэт зүйл" },
      { href: "/about#life", label: "Ажилтны түүх" },
      { href: "/about#clubs", label: "Хобби клубууд" },
    ],
  },
];

/**
 * Content plan 8 — Холбоо барих.
 *
 * TODO(HR): the plan gives the social handles but not their URLs, so those two
 * are printed rather than linked. Add `href` once the real page addresses are
 * confirmed — a guessed Facebook URL could point at someone else entirely.
 */
const contact: Array<{ label: string; value: string; href?: string }> = [
  { label: "Утас", value: "+976 7007-3003", href: "tel:+97670073003" },
  { label: "Утас", value: "9660-0059", href: "tel:+97696600059" },
  {
    label: "Имэйл",
    value: "Oyuerdene.s@shunkhlai.mn",
    href: "mailto:Oyuerdene.s@shunkhlai.mn",
  },
  { label: "Facebook", value: "Shunkhlai HR" },
  { label: "Instagram", value: "Shunkhlai_jobs" },
];

export function SiteFooter() {
  return (
    <footer className="relative bg-secondary/40">
      <SectionRule />
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-lg font-semibold tracking-[-0.02em]">
              Шунхлай ХХК
            </p>
            <GradientRule className="mt-4 max-w-[5rem] rounded-full" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Хөдөлмөр — хөгжлийн хөдөлгүүр. 1993 оноос хойш Монгол улсын
              эрчим хүч, логистикийн дэд бүтцийг бүтээж байна.
            </p>

            <ul className="mt-7 space-y-2">
              {contact.map((item) => (
                <li key={item.value} className="text-sm">
                  <span className="text-muted-foreground">{item.label}: </span>
                  {item.href ? (
                    <a
                      href={item.href}
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

            <p className="mt-5 text-sm text-muted-foreground">
              Даваа–Баасан 09:00–18:00
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[0.8125rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {column.title}
              </p>
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
          the edge of the window. Faint enough to sit under that line without
          competing with it — it is the same name, said quietly.

          Two cuts, because the whole drawing scales with its box and the dots
          go with it. On a phone the eleven-glyph version would be set so small
          that the grid closes up into a smear, so the narrow one drops the ХХК
          — fewer letters, larger type — and coarsens the screen to match. */}
      <div className="mx-auto max-w-6xl px-6 pb-6 lg:px-10">
        <DotWordmark
          text="ШУНХЛАЙ"
          id="dot-wordmark-screen-sm"
          pitch={0.04}
          className="block w-full text-foreground/[0.11] sm:hidden"
        />
        <DotWordmark
          text="ШУНХЛАЙ ХХК"
          className="hidden w-full text-foreground/[0.11] sm:block"
        />
      </div>
    </footer>
  );
}
