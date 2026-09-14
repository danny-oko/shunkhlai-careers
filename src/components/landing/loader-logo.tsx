"use client";

import * as React from "react";

import { BrandMark } from "@/components/brand/brand-logo";
import { SITE_BRAND_ID } from "@/components/site-header";

type Flight = { dx: number; dy: number; scale: number };

/**
 * The wordmark that closes the opening loader: it arrives over the map, then
 * flies into the header's own brand lockup and hands over to it.
 *
 * The flight is measured, not hard-coded. This element's box and the header
 * brand's box are read from the DOM, so the wordmark lands exactly on the
 * header at any viewport width and the handover is a fade between two things
 * already in the same place.
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
      const from = ref.current?.getBoundingClientRect();
      const to = document.getElementById(SITE_BRAND_ID)?.getBoundingClientRect();
      if (!from?.height || !to?.height) return;

      setFlight({
        dx: to.left + to.width / 2 - (from.left + from.width / 2),
        dy: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: to.height / from.height,
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
          transformOrigin: "center",
          transition: `transform ${durationMs}ms cubic-bezier(0.65, 0, 0.2, 1), opacity 400ms ease-out`,
          opacity: visible ? 1 : 0,
        }}
      >
        <BrandMark
          className="h-9 sm:h-11"
          sizes="(min-width: 640px) 132px, 108px"
          priority
        />
        <span className="text-3xl font-semibold tracking-[-0.04em] whitespace-nowrap sm:text-5xl">
          Шунхлай <span className="opacity-55">ХХК</span>
        </span>
      </div>
    </div>
  );
}
