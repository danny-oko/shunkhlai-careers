"use client";

import * as React from "react";

import { BrandMark } from "@/components/brand/brand-logo";
import { SITE_BRAND_ID } from "@/components/site-header";

type Flight = {
  dx: number;
  dy: number;
  scale: number;
  /** The mark's own centre, in the flying element's coordinates. */
  originX: number;
  originY: number;
};

/**
 * The wordmark that closes the opening loader: it arrives over the map, then
 * flies into the header's own brand lockup and hands over to it.
 *
 * The flight is measured, not hard-coded. It is measured **mark to mark** —
 * the eagle here onto the eagle in the header — and not lockup to lockup,
 * because the two lockups are not the same shape and never could be. This one
 * reads "Шунхлай ХХК" at 48px beside a 44px bird, so the bird is 30% of its
 * width; the header's reads "Шунхлай" at 14px beside a 24px bird, where the
 * bird is 50%. Centring one box on the other and scaling by their heights —
 * what this did before — put the eagle 43px to the left of the header's and
 * drew it at 92% of its size, and the two words landed on top of each other as
 * a smear. The miss was the same 43px at 1280, 1536 and 2560: not a rounding
 * error, a shape mismatch.
 *
 * So the eagle is the thing that lands, `transform-origin` is moved onto its
 * centre so the translation is simply "where it is now" to "where it must be",
 * and the scale is taken from the two marks rather than the two boxes. The
 * name beside it fades out over the first part of the flight: at the scale
 * that lands the bird it would still be drawn at 26px over the header's 14px,
 * and the header's own name is already sitting there waiting.
 */
export function LoaderLogo({
  visible,
  flying,
  durationMs,
}: {
  visible: boolean;
  flying: boolean;
  durationMs: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [flight, setFlight] = React.useState<Flight | null>(null);

  React.useEffect(() => {
    const measure = () => {
      const box = ref.current;
      const mark = box?.querySelector("img");
      const target = document
        .getElementById(SITE_BRAND_ID)
        ?.querySelector("img");
      if (!box || !mark || !target) return;

      const from = box.getBoundingClientRect();
      const fromMark = mark.getBoundingClientRect();
      const toMark = target.getBoundingClientRect();
      if (!fromMark.height || !toMark.height) return;

      setFlight({
        dx: toMark.left + toMark.width / 2 - (fromMark.left + fromMark.width / 2),
        dy: toMark.top + toMark.height / 2 - (fromMark.top + fromMark.height / 2),
        scale: toMark.height / fromMark.height,
        originX: fromMark.left + fromMark.width / 2 - from.left,
        originY: fromMark.top + fromMark.height / 2 - from.top,
      });
    };

    measure();
    // Web fonts change both boxes, so take the flight again once they land.
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const landed = flying && flight;

  return (
    // Untransformed, so its box stays the flight's measured origin.
    <div ref={ref} className="w-fit">
      <div
        className="flex items-center gap-3 sm:gap-4"
        style={{
          transform: landed
            ? `translate3d(${flight.dx}px, ${flight.dy}px, 0) scale(${flight.scale})`
            : undefined,
          transformOrigin: flight
            ? `${flight.originX}px ${flight.originY}px`
            : "center",
          transition: `transform ${durationMs}ms cubic-bezier(0.65, 0, 0.2, 1), opacity 400ms ease-out`,
          opacity: visible ? 1 : 0,
        }}
      >
        <BrandMark
          className="h-9 sm:h-11"
          sizes="(min-width: 640px) 132px, 108px"
          priority
        />
        {/* Gone before the bird arrives, not carried in beside it. Keyed to
            `landed` rather than to `flying`, so that if the measurement never
            landed — no header to aim at — the lockup stays whole to the end
            instead of shedding its name and going nowhere. */}
        <span
          className="text-3xl font-semibold tracking-[-0.04em] whitespace-nowrap sm:text-5xl"
          style={{
            opacity: landed ? 0 : 1,
            transition: `opacity ${Math.round(durationMs * 0.45)}ms ease-out`,
          }}
        >
          Шунхлай <span className="opacity-55">ХХК</span>
        </span>
      </div>
    </div>
  );
}
