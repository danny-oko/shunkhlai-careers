import { cn } from "@/lib/utils";

/**
 * A single continuously scrolling rail.
 *
 * The children are rendered twice inside a `w-max` track and the track is
 * translated by exactly -50%, so the loop has no visible seam. Pure CSS, so
 * this stays a server component.
 */
export function FieldMarquee({
  items,
  reverse = false,
  durationSeconds = 42,
  className,
}: {
  items: string[];
  reverse?: boolean;
  durationSeconds?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "brand-marquee-group relative overflow-hidden",
        "[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-max",
          reverse ? "brand-marquee-reverse" : "brand-marquee",
        )}
        style={{ "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties}
      >
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center">
            {items.map((item) => (
              <li
                key={item}
                className="flex items-center gap-6 pr-6 text-2xl font-semibold tracking-[-0.03em] whitespace-nowrap sm:text-3xl"
              >
                {item}
                <span
                  className="size-1.5 rounded-full bg-brand"
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
