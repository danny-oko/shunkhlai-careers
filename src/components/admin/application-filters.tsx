import Link from "next/link";

import type { Option } from "@/app/admin/applications/filters";
import { cn } from "@/lib/utils";

/**
 * The desk's two filters, as rows of pills.
 *
 * The newsroom desk's pattern, deliberately — same rounded pill, same
 * inversion for the chosen one, same trailing count, same `aria-current`, and
 * the same "a filter is a link, not a control" idea, so the whole state of the
 * screen is in the URL and can be sent to somebody. Two desks one click apart
 * should not have two vocabularies for "pick one of these".
 *
 * The one difference from the newsroom's is the size: these are the 38px / 13px
 * of the repo's own secondary-control standard (`docs/ARCHITECTURE.md`,
 * invariant 5) rather than the newsroom's smaller 11px. The labels here are
 * whole Mongolian phrases — «Дахин оролдож байна», a posting's full title —
 * and at 11px a two-row bar of them stops being scannable, which is the thing
 * the pills exist to be.
 */
export function FilterPills({
  label,
  options,
  current,
  href,
}: {
  /** The accessible name of the row — «Төлвөөр шүүх». */
  label: string;
  options: readonly Option[];
  current: string;
  /** The destination for one option's value. */
  href: (value: string) => string;
}) {
  return (
    /* One scrolling line on a phone, a wrapping row from `sm`.
       Five postings wrapped into three lines each pushed the first application
       most of a screen down at 390px — a filter bar taller than the thing it
       filters. Scrolling keeps it to one line without hiding any option, and
       the gutter bleed lets the row run to both edges so it reads as
       scrollable. */
    <nav
      aria-label={label}
      className="no-scrollbar -mx-5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={href(option.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-[2.375rem] max-w-[16rem] shrink-0 items-center rounded-full border px-3 text-[0.8125rem] transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "border-transparent bg-foreground font-medium text-background"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="truncate">{option.label}</span>
            <span className="ml-1.5 shrink-0 tabular-nums opacity-60">{option.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
