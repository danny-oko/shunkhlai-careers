"use client";

import * as React from "react";

import { usePalette } from "@/components/palette-provider";
import { Button } from "@/components/ui/button";
import { getPalette, nextPaletteId } from "@/lib/palettes";
import { cn } from "@/lib/utils";

/**
 * The swatch on the button: the site's 60-30-10 split drawn as a ring.
 *
 * The three arcs are the three roles, in their real proportions - 60% ground,
 * 30% ink, 10% accent - and they are painted from the live custom properties
 * rather than from a table of hexes. So the swatch is correct on the very
 * first frame, before React has hydrated and before it knows which scheme is
 * on, and it follows light/dark as well as the palette.
 */
function PaletteRing({ className }: { className?: string }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const roles = [
    { color: "var(--background)", share: 0.6 },
    { color: "var(--ink)", share: 0.3 },
    { color: "var(--brand)", share: 0.1 },
  ];

  let travelled = 0;

  return (
    <svg viewBox="0 0 16 16" className={cn("size-4", className)} aria-hidden>
      {/* Under the arcs, so the 60% ground reads as a ring even when it is
          the same colour as the header behind it. */}
      <circle
        cx={8}
        cy={8}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={4.4}
      />
      <g transform="rotate(-90 8 8)">
        {roles.map((role) => {
          const length = circumference * role.share;
          const arc = (
            <circle
              key={role.color}
              cx={8}
              cy={8}
              r={radius}
              fill="none"
              stroke={role.color}
              strokeWidth={3.4}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-travelled}
            />
          );
          travelled += length;
          return arc;
        })}
      </g>
    </svg>
  );
}

/**
 * Steps the whole site through its colour schemes, one press at a time.
 *
 * Sits next to `ThemeToggle` and works the same way: icon only, named for a
 * screen reader. The label carries both the scheme that is on and the one the
 * next press will bring, because a ring of four colours cannot say that by
 * itself.
 */
export function PaletteToggle({ className }: { className?: string }) {
  const { palette, cyclePalette } = usePalette();
  const current = getPalette(palette);
  const upcoming = getPalette(nextPaletteId(palette));

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Өнгөний хослол: ${current.label}. Дарвал ${upcoming.label} болно.`}
      title={`${current.label} - ${current.source}`}
      onClick={cyclePalette}
      className={cn("rounded-full", className)}
    >
      <PaletteRing />
    </Button>
  );
}
