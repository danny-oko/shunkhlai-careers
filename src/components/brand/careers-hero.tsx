import Link from "next/link";

import { FuelNetwork } from "@/components/brand/fuel-network";
import { Rise } from "@/components/brand/rise";

/**
 * The stage is the company's own network: fuel leaving Ulaanbaatar for the
 * aimag centres, drawn over Mongolia as a dot matrix. It says what Shunkhlai
 * does without a line of copy, and it is the one place on the page where
 * anything moves.
 *
 * Set on the ink panel rather than the page ground so the orange has
 * somewhere dark to read against, in both themes.
 */
export function CareersHero({ roleCount }: { roleCount: number }) {
  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--ink)] text-[color:var(--ink-foreground)]">
      {/* Survey grid, the scale the network is plotted on. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,var(--ink-muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--ink-muted)_1px,transparent_1px)] [background-size:72px_72px]"
      />

      <FuelNetwork className="absolute inset-y-0 right-0 -z-10 hidden w-[62%] md:block" />
      <FuelNetwork className="absolute inset-x-0 top-0 -z-10 h-1/2 opacity-70 md:hidden" />

      <div className="mx-auto grid max-w-6xl px-6 pt-48 pb-14 sm:pt-20 sm:pb-20 lg:px-10">
        <div className="max-w-xl">
          <Rise>
            <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
              Хөгжлийн төлөөх хөдөлгүүр
              <br className="hidden sm:block" /> бүрийг тэжээнэ
            </h1>
          </Rise>

          <Rise delay={120}>
            <p className="mt-5 text-base leading-relaxed text-[color:var(--ink-muted)] sm:text-lg">
              Эрчим хүч, тээвэр, дижитал дэд бүтцийг бүтээж буй багт нэгдээрэй.
              Одоо{" "}
              <span className="font-medium text-[color:var(--ink-foreground)] tabular-nums">
                {roleCount}
              </span>{" "}
              ажлын байр нээлттэй.
            </p>
          </Rise>

          <Rise delay={220}>
            <Link
              href="#jobs"
              className="bg-brand text-brand-foreground mt-8 inline-flex h-11 items-center rounded-full px-6 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-[color:var(--brand)]/50 focus-visible:outline-none"
            >
              Нээлттэй ажлын байр үзэх
            </Link>
          </Rise>
        </div>
      </div>
    </section>
  );
}
