import type { CSSProperties } from "react";

/**
 * Mongolia as a dot matrix with fuel running out of Ulaanbaatar.
 *
 * Shunkhlai's business is moving fuel across the country, so the hero draws
 * that: the dot mask is the territory, the lines are the routes, and a short
 * orange dash travels each one on a loop. The dash is the only moving thing
 * on the page.
 *
 * Coordinates and the mask come from `landing/mongolia-map.tsx` — world units
 * at 0.1 degree each, x = (lon+180)/360*3600, y = (90-lat)/180*1800 — so the
 * route ends land on the real towns. Regenerate the mask with
 * `node scripts/generate-map-dots.mjs`.
 */
const VIEW_BOX = "2668 372 340 122";

const MASK: CSSProperties = {
  maskImage: "url(/brand/mongolia-dots.svg)",
  WebkitMaskImage: "url(/brand/mongolia-dots.svg)",
  maskSize: "100% 100%",
  WebkitMaskSize: "100% 100%",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
};

const ULAANBAATAR = { x: 2869.2, y: 420.8 };

/** Six destinations, spread around the compass so no two routes overlap. */
const ROUTES = [
  { name: "Баян-Өлгий", x: 2699.6, y: 410.3, seconds: 7.5 },
  { name: "Хөвсгөл", x: 2801.6, y: 403.7, seconds: 5.5 },
  { name: "Дархан-Уул", x: 2859.2, y: 405.1, seconds: 3.2 },
  { name: "Дорнод", x: 2945.3, y: 419.2, seconds: 4.6 },
  { name: "Өмнөговь", x: 2844.2, y: 464.3, seconds: 5 },
  { name: "Ховд", x: 2716.4, y: 419.9, seconds: 6.8 },
];

/**
 * A route bows away from the straight line so overlapping corridors stay
 * readable, by an eighth of its own length.
 */
function arc(to: { x: number; y: number }): string {
  const dx = to.x - ULAANBAATAR.x;
  const dy = to.y - ULAANBAATAR.y;
  const bow = Math.hypot(dx, dy) / 8;
  const length = Math.hypot(dx, dy) || 1;
  const cx = (ULAANBAATAR.x + to.x) / 2 + (-dy / length) * bow;
  const cy = (ULAANBAATAR.y + to.y) / 2 + (dx / length) * bow;
  return `M${ULAANBAATAR.x} ${ULAANBAATAR.y} Q${cx} ${cy} ${to.x} ${to.y}`;
}

export function FuelNetwork({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {/* The territory: one file, painted by whatever colour sits behind it. */}
      <div
        className="absolute inset-0 bg-[color:var(--ink-muted)] opacity-[0.18]"
        style={MASK}
      />

      <svg
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {ROUTES.map((route) => (
          <g key={route.name}>
            <path
              d={arc(route)}
              fill="none"
              stroke="var(--ink-muted)"
              strokeWidth={0.35}
              strokeOpacity={0.35}
              strokeLinecap="round"
            />
            <path
              className="brand-haul"
              d={arc(route)}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={0.7}
              strokeLinecap="round"
              style={{ animationDuration: `${route.seconds}s` }}
            />
            <circle cx={route.x} cy={route.y} r={0.9} fill="var(--ink-muted)" />
          </g>
        ))}

        <circle cx={ULAANBAATAR.x} cy={ULAANBAATAR.y} r={1.6} fill="var(--brand)" />
      </svg>
    </div>
  );
}
