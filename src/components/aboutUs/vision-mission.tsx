import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";
import { mission, vision } from "@/lib/company";

const blocks = [vision, mission];

/**
 * Алсын хараа / Эрхэм зорилго — the first panel of the culture section.
 *
 * The two keep their own labels even though the tab above already says the
 * first of them: without them there would be no telling where the vision ends
 * and the mission begins.
 */
export function VisionPanel() {
  return (
    <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
      {blocks.map((block, index) => (
        <Reveal key={block.label} delay={index * 130}>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
            {block.label} · {block.labelEn}
          </p>

          <GradientRule className="mt-6 max-w-20 rounded-full" />

          <p className="mt-8 text-2xl leading-[1.2] font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
            {block.statement}
          </p>
          <p className="mt-6 text-base leading-relaxed text-ink-muted text-pretty">
            {block.body}
          </p>
        </Reveal>
      ))}
    </div>
  );
}
