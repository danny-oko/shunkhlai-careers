import type { CSSProperties } from "react";

/**
 * Mongolia as dots, with the aimag centres marked on top.
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

/**
 * The capital and all 21 aimag centres, projected with
 * x = (lon+180)/360*3600, y = (90-lat)/180*1800.
 *
 * Ordered outward from Ulaanbaatar, so revealing them in turn reads as the
 * network spreading from the centre. Every point was checked against
 * Mongolia's own border polygon before being written down here.
 */
const AIMAGS = [
  { name: "Улаанбаатар", x: 2869.2, y: 420.8 },
  { name: "Төв", x: 2869.5, y: 422.9 },
  { name: "Дундговь", x: 2862.7, y: 442.4 },
  { name: "Сэлэнгэ", x: 2862.1, y: 397.8 },
  { name: "Дархан-Уул", x: 2859.2, y: 405.1 },
  { name: "Говьсүмбэр", x: 2883.6, y: 436.4 },
  { name: "Хэнтий", x: 2906.6, y: 426.8 },
  { name: "Булган", x: 2835.3, y: 411.9 },
  { name: "Орхон", x: 2840.8, y: 409.7 },
  { name: "Өвөрхангай", x: 2827.8, y: 437.4 },
  { name: "Дорноговь", x: 2901.4, y: 451.1 },
  { name: "Архангай", x: 2814.5, y: 425.2 },
  { name: "Өмнөговь", x: 2844.2, y: 464.3 },
  { name: "Хөвсгөл", x: 2801.6, y: 403.7 },
  { name: "Баянхонгор", x: 2807.2, y: 438.1 },
  { name: "Сүхбаатар", x: 2932.8, y: 433.2 },
  { name: "Завхан", x: 2768.4, y: 422.6 },
  { name: "Дорнод", x: 2945.3, y: 419.2 },
  { name: "Говь-Алтай", x: 2762.6, y: 436.3 },
  { name: "Увс", x: 2720.7, y: 400.2 },
  { name: "Ховд", x: 2716.4, y: 419.9 },
  { name: "Баян-Өлгий", x: 2699.6, y: 410.3 },
];

/** Every marker is out by this share of the run, with this much fade each. */
const LAST_AT = 0.85;
const FADE = 0.08;

/**
 * A map pin drawn in its own 24x24 box with the point at (12, 22), so placing
 * one is `translate` to the coordinate, `scale`, then `translate` the tip back
 * to the origin. Scaled small: several aimag centres sit within a few map
 * units of each other, and the outline in the page colour is what keeps two
 * overlapping pins apart.
 */
const PIN =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";
const PIN_SCALE = 0.26;
const CAPITAL_SCALE = 0.34;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export function MongoliaMap({
  className,
  style,
  progress,
}: {
  className?: string;
  style?: CSSProperties;
  /** 0 to 1 to bring the aimags out one at a time. Omit to show them all. */
  progress?: number;
}) {
  const shownAt = (index: number) => {
    if (progress === undefined) return 1;
    return clamp(
      (progress - (index / (AIMAGS.length - 1)) * LAST_AT) / FADE,
    );
  };

  return (
    <div aria-hidden className={className} style={style}>
      <div className="relative aspect-[340/122] w-full">
        <div className="absolute inset-0 bg-foreground/30" style={MASK} />

        <svg
          viewBox={VIEW_BOX}
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {AIMAGS.map((place, index) => {
            const shown = shownAt(index);
            if (shown <= 0) return null;
            const isCapital = index === 0;

            return (
              <g key={place.name} opacity={shown}>
                {isCapital && (
                  <circle
                    cx={place.x}
                    cy={place.y}
                    r={4}
                    className="fill-brand/30"
                  >
                    <animate
                      attributeName="r"
                      values="3.5;8;3.5"
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
                <g
                  transform={`translate(${place.x} ${place.y}) scale(${
                    isCapital ? CAPITAL_SCALE : PIN_SCALE
                  }) translate(-12 -22)`}
                >
                  <path
                    d={PIN}
                    className="fill-brand stroke-background"
                    strokeWidth={1.6}
                    paintOrder="stroke"
                  />
                  <circle cx={12} cy={9} r={2.7} className="fill-background" />
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
