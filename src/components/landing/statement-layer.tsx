import { FeatherLattice } from "@/components/brand/feather-lattice";

/** The tail of the sentence, one line per swing. */
const TAIL = ["БҮРИЙН", "АРД", "ХҮН БАЙДАГ."];

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * The sentence, filling the screen.
 *
 * Proportions are the ones measured off the reference — the stacked lines at
 * 0.24 of the big word on a 1.2 pitch, bottoms on one line, a hairline gutter
 * between — scaled up to take about 86% of the viewport.
 *
 * `exit` runs 0 (holding the screen) to 1 (gone). It does not leave in one
 * piece: the type softens and dissolves first, and only then does the ground
 * behind it clear, so the road is uncovered by a fade rather than a wipe.
 */
export function StatementLayer({ exit }: { exit: number }) {
  const type = clamp(exit / 0.72);
  const ground = clamp((exit - 0.25) / 0.75);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: exit > 0.05 ? "none" : undefined }}
    >
      <div
        className="absolute inset-0 bg-ink"
        style={{ opacity: 1 - ground }}
      >
        <FeatherLattice className="opacity-[0.12]" tone="brand" />
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center text-ink-foreground"
        style={{
          opacity: 1 - type,
          filter: type > 0 ? `blur(${type * 14}px)` : undefined,
          transform: `translate3d(${type * 7}vw, 0, 0) scale(${1 + type * 0.06})`,
        }}
      >
        <p className="flex flex-col items-start gap-2 px-6 font-semibold uppercase sm:flex-row sm:items-end sm:gap-[1.2vw] sm:px-0">
          <span
            className="statement-line block text-[13vw] leading-[0.82] tracking-[-0.045em] sm:text-[11.5vw]"
            style={{ animationDelay: "0ms" }}
          >
            Хөдөлгүүр
          </span>

          <span className="flex flex-col text-[6vw] leading-[1.2] tracking-[-0.03em] sm:text-[3.2vw]">
            {TAIL.map((line, index) => (
              <span
                key={line}
                className="statement-line block"
                style={{ animationDelay: `${160 + index * 160}ms` }}
              >
                {line}
              </span>
            ))}
          </span>
        </p>
      </div>
    </div>
  );
}
