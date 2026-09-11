import { cn } from "@/lib/utils";

/**
 * How much of an advert's window is left, drawn as a fuel line.
 *
 * Shunkhlai moves fuel, and the brandbook's own device is the orange dissolve
 * (өнгөний уусалт, 1.3). Both meet here: the bar carries the one fact a
 * candidate acts on — how long they have left — in the brand's own gradient,
 * draining as the closing date approaches.
 *
 * The reading is decorative on its own; the day count beside it carries the
 * same information as text, so this is hidden from assistive tech.
 */

/** Adverts run roughly a month, so a full line is 30 days. */
const WINDOW_DAYS = 30;

export function FuelLine({
  remainingDays,
  className,
}: {
  remainingDays: number;
  className?: string;
}) {
  const level = Math.max(0, Math.min(1, remainingDays / WINDOW_DAYS));
  const isClosed = remainingDays < 0;

  return (
    <span
      aria-hidden
      className={cn("block h-px w-full overflow-hidden bg-border", className)}
    >
      <span
        className={cn(
          "block h-full origin-left transition-transform duration-500",
          isClosed ? "bg-brand-navy" : "bg-[image:var(--brand-gradient)]",
        )}
        style={{ transform: `scaleX(${isClosed ? 0 : level})` }}
      />
    </span>
  );
}
