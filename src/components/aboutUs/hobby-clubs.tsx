import { GradientRule } from "@/components/brand/gradient-rule";
import { Reveal } from "@/components/reveal";
import { clubCount } from "@/lib/culture";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * Хобби клубууд.
 *
 * HR has confirmed the number but not yet the roster, so this states the
 * figure and nothing more. When the club names and photos arrive it becomes
 * the grid the brief asks for.
 */
export function HobbyClubs() {
  return (
    <section
      id="clubs"
      className="relative scroll-mt-20 py-20 lg:py-28"
    >
      <SectionRule />
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Хобби клубууд · Clubs
          </p>

          <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="text-6xl leading-none font-semibold tracking-[-0.04em] text-brand tabular-nums sm:text-8xl">
              {clubCount}
            </span>
            <h2 className="text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
              төрлийн сонирхлын клуб
            </h2>
          </div>

          <GradientRule className="mt-10 max-w-[7rem] rounded-full" />

          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Ажилтнуудын чөлөөт цаг, хамтын үйл ажиллагааг дэмжих зорилгоор
            урлаг, спорт, олон нийтийн арга хэмжээг тогтмол зохион байгуулдаг.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
