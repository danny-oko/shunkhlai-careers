import { FeatherLattice } from "@/components/brand/feather-lattice";
import { Rise } from "@/components/brand/rise";

/**
 * A short band, not a landing hero. People arrive here to find a job, so the
 * page spends its vertical space on the list and lets the headline share a
 * row with the slogan instead of stacking under it.
 *
 * The slogan is set in flat brand orange rather than the dissolve: the
 * brandbook permits collapsing the gradient to a single colour (1.4.1), and
 * on this page the gradient is reserved for the fuel lines, where it carries
 * information rather than decorating.
 */
export function CareersHero({ roleCount }: { roleCount: number }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/70">
      <FeatherLattice
        className="-z-10 opacity-25 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_40%,black_10%,transparent_100%)]"
        tone="brand"
      />

      <div className="mx-auto max-w-6xl px-6 pt-12 pb-10 sm:pt-16 lg:px-10">
        <Rise className="flex flex-col gap-x-10 gap-y-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
              Нээлттэй ажлын байр
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {roleCount}
              </span>{" "}
              ажлын байр нээлттэй байна.
            </p>
          </div>

          <p className="text-brand max-w-xs text-base leading-snug font-medium text-pretty md:text-right">
            Хөгжлийн төлөөх хөдөлгүүр бүрийг тэжээнэ
          </p>
        </Rise>
      </div>
    </section>
  );
}
