import type { ReactNode } from "react";

/**
 * The shapes every record on the admin desk is made of.
 *
 * A record is a record: a ruled heading and `<dl>` facts with hairlines
 * between them, the way a register looks on paper. Shared by
 * `application-detail.tsx` and `applicant-record.tsx` so the application and
 * the applicant behind it read as one document rather than two designs meeting
 * halfway down a page.
 */

export function Section({
  title,
  id,
  children,
}: {
  title: string;
  /** An anchor, for the анкет's section index. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-6 first:mt-0">
      <h2 className="news-headline border-b border-b-[var(--rule-strong)] pb-2 text-[0.9375rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * A titled block of the side column: smaller than a `Section`, because what
 * it holds (the application, its push) is context for the анкет beside it
 * rather than the thing being read.
 */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t-2 border-t-[var(--rule-strong)] pt-3">
      <h2 className="text-[0.6875rem] font-medium tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * One fact with its label above it — in the narrow side column, or two to a
 * row in the анкет. It replaced a label-left, value-right line, which left a
 * gap the width of the page between a label and its value; this reads the
 * same at any width.
 */
export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-b border-border py-2">
      <dt className="text-[0.75rem] text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 min-w-0 text-[0.8125rem] break-words">{children}</dd>
    </div>
  );
}

export const EMPTY = "—";

export const or = (value: string) => value || EMPTY;
