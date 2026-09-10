import { FeatherLattice } from "@/components/brand/feather-lattice";
import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";
import { mission, vision } from "@/lib/company";
import { SectionRule } from "@/components/brand/section-rule";

const blocks = [vision, mission];

/**
 * Алсын хараа / Эрхэм зорилго on the ink panel — the second "30%" surface of
 * the About page, keeping the two statements weighted above everything else.
 */
export function VisionMission() {
  return (
    <section
      id="vision"
      className="relative isolate scroll-mt-20 overflow-hidden bg-ink py-20 text-ink-foreground lg:py-28"
    >
      <FeatherLattice className="opacity-[0.16]" tone="brand" />
      <SectionRule />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {blocks.map((block, index) => (
            <Reveal key={block.label} delay={index * 130}>
              <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
                {block.label} · {block.labelEn}
              </p>

              <GradientRule className="mt-6 max-w-[5rem] rounded-full" />

              <p className="mt-8 text-2xl leading-[1.2] font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
                {block.statement}
              </p>
              <p className="mt-6 text-base leading-relaxed text-ink-muted text-pretty">
                {block.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
