import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Rise } from "@/components/brand/rise";

export function CareersHero({ roleCount }: { roleCount: number }) {
  return (
    <section className="relative isolate overflow-hidden">
      <FeatherLattice
        className="-z-10 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_20%,transparent_100%)]"
        tone="brand"
      />

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 lg:px-10">
        <Rise>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Шунхлай ХХК · Careers
          </p>
        </Rise>

        <Rise delay={90}>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            Open positions at Shunkhlai
          </h1>
        </Rise>

        <Rise delay={180} className="mt-8">
          <p className="brand-shimmer max-w-2xl text-xl leading-[1.25] font-semibold tracking-[-0.02em] text-balance sm:text-2xl">
            Хөгжлийн төлөөх хөдөлгүүр бүрийг тэжээнэ
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            We fuel every engine of progress.
          </p>
        </Rise>

        <Rise delay={260} className="mt-10">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Rise>

        <Rise delay={320}>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            We build the energy, logistics and digital infrastructure Mongolia
            runs on. {roleCount} roles are open right now.
          </p>
        </Rise>
      </div>
    </section>
  );
}
