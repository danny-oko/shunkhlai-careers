import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";
import { clubCount } from "@/lib/culture";

/**
 * Хобби клубууд.
 *
 * HR has confirmed the number but not yet the roster, so this states the
 * figure and nothing more. When the club names and photos arrive it becomes
 * the grid the brief asks for.
 */
export function ClubsPanel() {
  return (
    <Reveal>
      <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
        Clubs
      </p>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="text-6xl leading-none font-semibold tracking-[-0.04em] text-brand tabular-nums sm:text-8xl">
          {clubCount}
        </span>
        <h2 className="text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
          төрлийн сонирхлын клуб
        </h2>
      </div>

      <GradientRule className="mt-10 max-w-28 rounded-full" />

      <p className="mt-10 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty">
        Ажилтнуудын чөлөөт цаг, хамтын үйл ажиллагааг дэмжих зорилгоор урлаг,
        спорт, олон нийтийн арга хэмжээг тогтмол зохион байгуулдаг.
      </p>
    </Reveal>
  );
}
