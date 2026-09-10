import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";

/**
 * The page opens in Mongolian, because the people reading it work in
 * Mongolian. The slogan (brandbook p.4) carries the brand voice; it is set
 * in the specified orange dissolve but held still — the only motion here is
 * the one entrance.
 */
export function CareersHero({ roleCount }: { roleCount: number }) {
  return (
    <section className="relative isolate overflow-hidden">
      <FeatherLattice
        className="-z-10 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_20%,transparent_100%)]"
        tone="brand"
      />

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 lg:px-10">
        <Rise>
          <h1 className="max-w-3xl text-4xl leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
            Нээлттэй ажлын байр
          </h1>
        </Rise>

        <Rise delay={110} className="mt-7">
          <p className="brand-dissolve max-w-2xl text-xl leading-[1.3] font-semibold tracking-[-0.015em] text-balance sm:text-2xl">
            Хөгжлийн төлөөх хөдөлгүүр бүрийг тэжээнэ
          </p>
        </Rise>

        <Rise delay={200} className="mt-9">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Rise>

        <Rise delay={280}>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Шунхлай нь Монголын эрчим хүч, тээвэр, дижитал дэд бүтцийг
            бүтээдэг.{" "}
            <span className="font-medium text-foreground tabular-nums">
              Одоо {roleCount} ажлын байр нээлттэй
            </span>{" "}
            байна.
          </p>
        </Rise>
      </div>
    </section>
  );
}
