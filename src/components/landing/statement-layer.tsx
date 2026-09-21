import { FeatherLattice } from "@/components/brand/feather-lattice";

/** The head of the sentence, one line per swing. */
const LEAD = ["ХӨГЖЛИЙН", "ТӨЛӨӨХ"];

/** The tail of the sentence, one line per swing. */
const TAIL = ["БҮРИЙГ", "ТЭЖЭЭНЭ."];

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * The sentence, filling the screen.
 *
 * The big word carries a stacked column either side of it, bottoms on one
 * line, a hairline gutter between.
 *
 * It sits in the page's own container rather than being centred in the window,
 * so its left edge is the line the header's wordmark and every section below
 * start on. That is also why the type is capped rather than purely `vw`: the
 * container stops growing at 72rem and type that did not would have run out of
 * it on a wide screen. At the cap the sentence measures about 8.9 times the big
 * word's size, which is 1028 of the 1072px the container gives.
 *
 * Both sides of `sm` are bounded now, and the reason is the seam between them.
 * Stacked, the type was bare `vw` with nothing holding it back, so by 639px
 * the big word had grown to 70px and the two columns to 38; one pixel later
 * the row layout took over at 51px and 17px, and the sentence lost a third of
 * its size — and the columns more than half — in a single pixel of window.
 * The stacked sizes stop growing where the row layout picks them up, and the
 * row sizes have a floor to be picked up at, so the two meet instead of
 * colliding.
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
        <p className="mx-auto flex w-full max-w-6xl flex-col items-start gap-2 px-6 font-semibold uppercase sm:flex-row sm:items-end sm:gap-[1.2vw] lg:px-10">
          <span className="flex flex-col text-[min(6vw,1.5rem)] leading-[1.2] tracking-[-0.03em] sm:text-[clamp(1.375rem,2.6vw,2.34rem)]">
            {LEAD.map((line, index) => (
              <span
                key={line}
                className="statement-line block"
                style={{ animationDelay: `${index * 160}ms` }}
              >
                {line}
              </span>
            ))}
          </span>

          <span
            className="statement-line block text-[min(11vw,3.25rem)] leading-[0.82] tracking-[-0.045em] sm:text-[clamp(3rem,8vw,7.25rem)]"
            style={{ animationDelay: "320ms" }}
          >
            Хөдөлгүүр
          </span>

          <span className="flex flex-col text-[min(6vw,1.5rem)] leading-[1.2] tracking-[-0.03em] sm:text-[clamp(1.375rem,2.6vw,2.34rem)]">
            {TAIL.map((line, index) => (
              <span
                key={line}
                className="statement-line block"
                style={{ animationDelay: `${480 + index * 160}ms` }}
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
