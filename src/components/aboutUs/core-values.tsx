import { Reveal } from "@/components/reveal";
import { values } from "@/lib/company";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * Үнэт зүйл — brandbook p.3, with a line of context under each one.
 *
 * The numerals are the only orange on this section; the cards themselves stay
 * on the neutral ground so the list reads as text, not as buttons.
 */
export function CoreValues() {
  return (
    <section
      id="values"
      className="relative scroll-mt-20 py-20 lg:py-28"
    >
      <SectionRule />
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Үнэт зүйл · Our values
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Өдөр бүр шийдвэр гаргахад ашигладаг тав
          </h2>
        </Reveal>

        <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value, index) => (
            <Reveal
              as="li"
              key={value.mn}
              delay={index * 80}
              className="group border-t border-border pt-6 transition-colors duration-500 hover:border-brand"
            >
              <span className="font-mono text-xs text-brand tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>

              <h3 className="mt-4 text-lg leading-snug font-medium tracking-[-0.015em] text-pretty">
                {value.mn}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{value.en}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                {value.body}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
