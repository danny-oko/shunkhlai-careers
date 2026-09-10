import { HeartPulse } from "lucide-react";

import { FeatherLattice } from "@/components/brand/feather-lattice";
import { Reveal } from "@/components/reveal";
import { benefits } from "@/lib/culture";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * Хөнгөлөлт, хангамж — on ink, with the mental-health programme pulled out
 * of the grid because the brief calls it out as its own commitment.
 */
export function BenefitsGrid() {
  return (
    <section
      id="benefits"
      className="relative isolate scroll-mt-20 overflow-hidden bg-ink py-20 text-ink-foreground lg:py-28"
    >
      <SectionRule />
      <FeatherLattice className="opacity-[0.16]" tone="brand" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
            Хөнгөлөлт, хангамж · Benefits
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Ажлын дараах амьдралыг ч тооцдог
          </h2>
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:flex-row sm:items-center sm:gap-8">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <HeartPulse className="size-5" />
            </span>
            <div>
              <h3 className="text-lg font-medium tracking-[-0.015em]">
                Сэтгэл зүйн эрүүл мэндээ хамгаалах нь — ажилтны сайн сайхан
                байдлын үндэс
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted text-pretty">
                Шунхлай ХХК нь ажилтнуудынхаа сайн сайхан байдал, сэтгэл зүйн
                эрүүл мэндийг дэмжих чиглэлээр тогтмол сургалт, хөгжлийн
                хөтөлбөрүүдийг хэрэгжүүлдэг.
              </p>
            </div>
          </div>
        </Reveal>

        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {benefits.map((benefit, index) => (
            <Reveal
              as="li"
              key={benefit.title}
              delay={index * 70}
              className="border-t border-white/12 pt-6"
            >
              <h3 className="text-base font-medium tracking-[-0.01em]">
                {benefit.title}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">{benefit.titleEn}</p>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted text-pretty">
                {benefit.body}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
