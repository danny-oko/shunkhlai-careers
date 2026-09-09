import type { CSSProperties } from "react";

/**
 * Mongolia as dots, with the network drawn on top.
 *
 * The dot layer is a mask rather than an image, so the page paints its own
 * colour through it and one file serves both themes. The overlay SVG shares
 * the mask's view box — world coordinates at 0.1 degree per unit — so the
 * markers land on the right towns without any extra maths.
 *
 * Regenerate the mask with `node scripts/generate-map-dots.mjs`.
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

/** Projected with x = (lon+180)/360*3600, y = (90-lat)/180*1800. */
const sites = [
  { name: "Улаанбаатар", x: 2869.2, y: 420.8, hub: true },
  { name: "Дархан", x: 2859.5, y: 405.1 },
  { name: "Эрдэнэт", x: 2840.8, y: 409.7 },
  { name: "Мөрөн", x: 2801.6, y: 403.7 },
  { name: "Чойбалсан", x: 2945.3, y: 419.3 },
  { name: "Сайншанд", x: 2901.4, y: 451.1 },
  { name: "Даланзадгад", x: 2844.2, y: 464.3 },
  { name: "Алтай", x: 2762.5, y: 436.3 },
  { name: "Ховд", x: 2716.4, y: 419.9 },
];

export function MongoliaMap({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div aria-hidden className={className} style={style}>
      <div className="relative aspect-[340/122] w-full">
        <div className="absolute inset-0 bg-foreground/30" style={MASK} />

        <svg
          viewBox={VIEW_BOX}
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {sites.map((site, index) => (
            <g key={site.name}>
              {site.hub && (
                <circle
                  cx={site.x}
                  cy={site.y}
                  r={5}
                  className="fill-brand/25"
                >
                  <animate
                    attributeName="r"
                    values="4;9;4"
                    dur="2.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.5;0;0.5"
                    dur="2.6s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={site.x}
                cy={site.y}
                r={site.hub ? 3 : 2}
                className="fill-brand"
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.4s"
                  begin={`${0.5 + index * 0.12}s`}
                  fill="freeze"
                />
              </circle>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
