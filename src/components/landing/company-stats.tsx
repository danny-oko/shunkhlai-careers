import { FeatherLattice } from "@/components/brand/feather-lattice";
import { StatCounter } from "@/components/landing/stat-counter";
import { Reveal } from "@/components/reveal";
import { stats } from "@/lib/company";

/**
 * The scale of the company, on the deep ink panel.
 *
 * This is the first of the "30%" surfaces in the 60-30-10 split: neutral page,
 * ink panels for weight, orange kept for the numerals only.
 */
export function CompanyStats() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
      <FeatherLattice className="opacity-[0.18]" tone="brand" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
            Бидний хэмжээ · By the numbers
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
            1993 оноос хойш нэг ч өдөр зогсоогүй сүлжээ
          </h2>
        </Reveal>

        <dl className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 90}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-5xl leading-none font-semibold tracking-[-0.04em] text-brand-2 sm:text-6xl">
                  <StatCounter value={stat.value} suffix={stat.suffix} />
                </span>
                <span className="mt-4 block text-base font-medium tracking-[-0.01em]">
                  {stat.label}
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {stat.labelEn}
                </span>
              </dd>
            </Reveal>
          ))}
        </dl>

        <Reveal delay={200}>
          <p className="mt-14 max-w-2xl text-base leading-relaxed text-ink-muted text-pretty">
            Улаанбаатараас алслагдсан сум хүртэл, аймаг бүрийн замын хажууд ажилладаг
            хүмүүсийн ард агуулах, лаборатори, диспетчер, санхүү, инженерийн баг
            зогсдог.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
