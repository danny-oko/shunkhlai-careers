import { Reveal } from "@/components/reveal";
import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";

/** Brandbook p.3 - "ҮНЭТ ЗҮЙЛ". */
const values = [
  { mn: "Хэрэглэгчээ дээдлэх", en: "Put the customer first" },
  { mn: "Хүн бүр бүтээлч байх", en: "Everyone is creative" },
  { mn: "Хүрээлэн буй орчноо хайрлан хамгаалах", en: "Protect the environment" },
  { mn: "Хамтын ажиллагааг эрхэмлэх", en: "Value working together" },
  { mn: "Хариуцлагатай байх", en: "Be accountable" },
];

export function BrandValues() {
  return (
    <section className="relative isolate overflow-hidden border-t border-border/70">
      <FeatherLattice className="opacity-[0.55]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/70 to-background" />

      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Эрхэм зорилго · Our mission
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            Бид хүнийг дээдэлж, эрчимтэй хөгжлийг бүтээнэ.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
            We put people first and build momentum. That starts with who we
            hire.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <GradientRule className="max-w-[7rem] rounded-full" />
        </Reveal>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value, index) => (
            <Reveal as="li" key={value.mn} delay={160 + index * 90}>
              <span className="font-mono text-xs text-brand tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-base font-medium tracking-[-0.01em] text-pretty">
                {value.mn}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{value.en}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
