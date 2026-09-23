import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";
import { WingFacets } from "@/components/brand/wing-facets";

export function CareersHero({ roleCount }: { roleCount: number }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Two grounds, not one. The lattice is a texture - at 40% over white it
          is very nearly nothing, which is why this screen read as a headline
          on a blank page. The facets are the shape behind it: the eagle's wing
          taken apart and spread across the corner the headline does not use.
          Under the lattice, so the texture still runs over the top of them and
          the two read as one ground rather than as a picture with a screen on
          it. */}
      <WingFacets className="-z-20" />

      <FeatherLattice
        className="-z-10 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_20%,transparent_100%)]"
        tone="brand"
      />

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 lg:px-10">
        <Rise delay={90}>
          <h1 className="max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            Нээлттэй ажлын байр
          </h1>
        </Rise>

        <Rise delay={180} className="mt-8">
          <p className="brand-shimmer max-w-2xl text-xl leading-[1.25] font-semibold tracking-[-0.02em] text-balance sm:text-2xl">
            Хүчирхэг монголын хөгжлийн хүрд
          </p>
        </Rise>

        <Rise delay={260} className="mt-10">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Rise>

        <Rise delay={320}>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Монголыг хөдөлгөж буй эрчим хүч, тээвэр логистик, дижитал дэд
            бүтцийг бид бүтээж, найдвартай ажиллуулдаг. Одоогоор {roleCount}{" "}
            ажлын байр нээлттэй байна.
          </p>
        </Rise>
      </div>
    </section>
  );
}
