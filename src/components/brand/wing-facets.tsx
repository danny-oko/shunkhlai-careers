import { cn } from "@/lib/utils";

/**
 * The eagle's wing, taken apart into chevrons and spread across a hero.
 *
 * Brandbook 1.14 builds the mark out of repeated shapes; <ArcBloom> takes the
 * circles of that construction and this takes the wing. A Shunkhlai wing is a
 * stack of chevrons that widen as they leave the body, so the six here run in
 * the same direction at falling weights and never close up into the mark.
 *
 * Built from the brand's own three colours rather than a new set: the warm
 * pair carries the shapes nearest the reader and the blue sits behind them,
 * which at these opacities reads as the silver the brandbook's own artwork
 * has between its wings. Nothing here is a colour the site does not already
 * own, so both themes are served by the same declaration - every value is a
 * token, and the tokens are what change.
 */

/**
 * One chevron, as a closed path.
 *
 * Drawn rather than stroked: a stroke scales its width with the shape and
 * these are six sizes of the same figure, so a stroke would have made the big
 * ones heavy and the small ones hairlines. Each is the outline of a ">" -
 * out to the point, back in, and up the inside edge.
 */
const chevron = (x: number, y: number, size: number, arm: number) =>
  [
    `M${x} ${y - size}`,
    `L${x + size} ${y}`,
    `L${x} ${y + size}`,
    `L${x - arm} ${y + size}`,
    `L${x + size - arm} ${y}`,
    `L${x - arm} ${y - size}`,
    "Z",
  ].join(" ");

/**
 * Where the six sit, and how much of each is inked.
 *
 * The sizes fall from right to left and the opacities fall with them, so the
 * run reads as one wing receding rather than as six marks of equal weight.
 * `cool` hands a shape to the blue instead of the orange; two of the six take
 * it, which is enough to keep the group from reading as a single flat tint.
 */
const FACETS = [
  { x: 1120, y: 150, size: 260, arm: 78, opacity: 0.1 },
  { x: 900, y: 250, size: 200, arm: 62, opacity: 0.075, cool: true },
  { x: 1010, y: 430, size: 170, arm: 52, opacity: 0.065 },
  { x: 760, y: 90, size: 130, arm: 40, opacity: 0.055, cool: true },
  { x: 690, y: 420, size: 110, arm: 34, opacity: 0.045 },
  { x: 560, y: 250, size: 80, arm: 26, opacity: 0.035 },
];

export function WingFacets({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {/* The wash the shapes sit in. Two corners lit and the middle left
          alone, so the page still has somewhere quiet to set a headline. */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(60% 70% at 88% 6%, color-mix(in oklab, var(--brand) 16%, transparent) 0%, transparent 70%)",
            "radial-gradient(55% 65% at 62% 96%, color-mix(in oklab, var(--brand-2) 12%, transparent) 0%, transparent 72%)",
            "radial-gradient(70% 80% at 106% 62%, color-mix(in oklab, var(--brand-blue) 14%, transparent) 0%, transparent 70%)",
          ].join(", "),
        }}
      />

      {/* `slice` for the same reason a photograph is cover-cropped: the box
          this fills is a hero, which is much wider than it is tall on a
          desktop and nearly square on a phone, and a fitted drawing would
          have left the shapes stranded in the middle of the wide one. */}
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        // Drawn in from the left rather than butted against the text: the
        // headline sits in the first third of the measure, and a shape that
        // reaches it stops being a ground and starts being a thing behind
        // the words.
        style={{
          maskImage:
            "linear-gradient(100deg, transparent 4%, #000 46%, #000 100%)",
        }}
      >
        <defs>
          <linearGradient id="wing-facet-warm" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
          <linearGradient id="wing-facet-cool" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="var(--brand-blue)" />
            <stop offset="100%" stopColor="var(--brand-navy)" />
          </linearGradient>
        </defs>

        {FACETS.map((facet) => (
          <path
            key={`${facet.x}-${facet.y}`}
            d={chevron(facet.x, facet.y, facet.size, facet.arm)}
            fill={`url(#wing-facet-${facet.cool ? "cool" : "warm"})`}
            opacity={facet.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
