import type { ReactNode } from "react";

/**
 * The two shapes every record on the admin desk is made of.
 *
 * A record is a record: a ruled heading and `<dl>` lines with hairlines
 * between them, the way a register looks on paper. Shared by
 * `application-detail.tsx` and `applicant-record.tsx` so the application and
 * the applicant behind it read as one document rather than two designs meeting
 * halfway down a page.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="news-headline border-b border-b-[var(--rule-strong)] pb-2 text-[0.9375rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One line of a record. */
export function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-border py-2.5">
      <dt className="text-[0.8125rem] text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-right text-[0.8125rem]">{children}</dd>
    </div>
  );
}

export const EMPTY = "—";

export const or = (value: string) => value || EMPTY;
