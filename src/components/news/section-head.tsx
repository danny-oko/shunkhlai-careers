import { cn } from "@/lib/utils";

/**
 * The label that divides one run of stories from the next.
 *
 * A rule with the section name sitting on it — the print convention, and the
 * reason it works here is that it is the only horizontal rule on the page
 * carrying type, so it reads as a boundary rather than as another separator.
 */
export function SectionHead({
  title,
  note,
  className,
}: {
  title: string;
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b-2 border-b-[var(--rule-strong)] pb-2",
        className,
      )}
    >
      <h2 className="type-kicker font-semibold tracking-[0.16em] uppercase">
        {title}
      </h2>
      {note && (
        <p className="type-kicker tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
          {note}
        </p>
      )}
    </div>
  );
}
