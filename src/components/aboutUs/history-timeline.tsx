import { Reveal } from "@/components/reveal";
import { milestones } from "@/lib/company";

/**
 * Бидний түүх — 1993 to today.
 *
 * A single rail runs the height of the section with the brand gradient; each
 * milestone lifts in as it reaches the viewport, so the story reads at the
 * pace the visitor scrolls it.
 */
export function HistoryTimeline() {
  return (
    <section
      id="history"
      className="scroll-mt-20 border-t border-border/70 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <p className="text-[0.8125rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Бидний түүх · Our story
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            30 гаруй жилийн зам
          </h2>
        </Reveal>

        <ol className="relative mt-16 pl-8 sm:pl-0">
          {/* The rail. On desktop it sits in the gutter between the period
              column and the copy column. */}
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[3px] w-px opacity-70 sm:left-[calc(9rem+3px)]"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, var(--brand), var(--brand-2), color-mix(in oklab, var(--brand-2) 15%, transparent))",
            }}
          />

          {milestones.map((milestone, index) => (
            <Reveal
              as="li"
              key={milestone.period}
              delay={index * 90}
              className="relative pb-14 last:pb-0 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-x-10"
            >
              <span
                aria-hidden
                className="absolute top-1.5 -left-8 size-[9px] rounded-full bg-brand ring-4 ring-background sm:left-[calc(9rem-1px)]"
              />

              <p className="font-mono text-sm tracking-[0.08em] text-brand tabular-nums">
                {milestone.period}
              </p>

              <div className="mt-3 sm:mt-0">
                <h3 className="text-xl leading-tight font-semibold tracking-[-0.025em]">
                  {milestone.title}
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
                  {milestone.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
