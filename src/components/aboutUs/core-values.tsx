import { Reveal } from "@/components/reveal";
import { values } from "@/lib/company";

/**
 * Үнэт зүйл — brandbook p.3, with a line of context under each one.
 *
 * The numerals are the only orange in the panel; the entries themselves stay
 * plain so the list reads as text, not as buttons. Only the English half of
 * the label is left — the Mongolian one is on the tab that opened this.
 */
export function ValuesPanel() {
  return (
    <>
      <Reveal>
        <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-ink-muted uppercase">
          Our values
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
            className="border-t border-white/12 pt-6 transition-colors duration-500 hover:border-brand"
          >
            <span className="font-mono text-xs text-brand tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>

            <h3 className="mt-4 text-lg leading-snug font-medium tracking-[-0.015em] text-pretty">
              {value.mn}
            </h3>
            <p className="mt-1.5 text-sm text-ink-muted">{value.en}</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted text-pretty">
              {value.body}
            </p>
          </Reveal>
        ))}
      </ul>
    </>
  );
}
