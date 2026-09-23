import { FeatherLattice } from "@/components/brand/feather-lattice";

/** The motto, two words to a line, one line per swing. */
const LINES = ["ХҮЧИРХЭГ МОНГОЛЫН", "ХӨГЖЛИЙН ХҮРД"];

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * The sentence, filling the screen.
 *
 * Both lines carry the same weight, centred on one another, so the motto reads
 * as one block rather than a big word with satellites. The gap between them is
 * set in `em` rather than px so the two lines keep the same air at every size
 * the clamp hands them.
 *
 * It sits in the page's own container rather than being sized to the window,
 * so it never grows past the measure every section below it is set in. That is
 * also why the type is capped rather than purely `vw`: the container stops
 * growing at 72rem and type that did not would have run out of it on a wide
 * screen. The cap is set by the longer line — seventeen characters — which at
 * 5.25rem measures about 830 of the 1072px the container gives, leaving the
 * tracking room to breathe.
 *
 * The floor works the same way from the other end: at 320px the container is
 * 272px wide, and 1.5rem is the largest size that line still fits in, so the
 * `vw` term is bounded on both sides and never hands the layout a size the
 * screen cannot hold.
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
      <div className="absolute inset-0 bg-ink" style={{ opacity: 1 - ground }}>
        <FeatherLattice className="opacity-[0.12]" tone="brand" />
      </div>

      <div
        className="absolute inset-0 flex items-center text-ink-foreground"
        style={{
          opacity: 1 - type,
          filter: type > 0 ? `blur(${type * 14}px)` : undefined,
          transform: `translate3d(${type * 7}vw, 0, 0) scale(${1 + type * 0.06})`,
        }}
      >
        <p className="mx-auto flex w-full max-w-6xl flex-col items-center gap-[0.22em] px-6 text-center font-semibold uppercase leading-[0.92] tracking-[-0.045em] text-[clamp(1.5rem,5.8vw,5.25rem)] lg:px-10">
          {LINES.map((line, index) => (
            <span
              key={line}
              className="statement-line block"
              style={{ animationDelay: `${index * 200}ms` }}
            >
              {line}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
