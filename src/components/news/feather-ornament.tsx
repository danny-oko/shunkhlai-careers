import { cn } from "@/lib/utils";

/**
 * The brandbook's feather glyph (1.15) as a single printer's ornament.
 *
 * <FeatherLattice> draws the same motif, but tessellated edge to edge as a
 * ground. A masthead wants the opposite of a ground: one mark, sitting on a
 * line, with paper around it. Drawn on its own here rather than by masking the
 * lattice down to one tile, which would have brought the neighbouring tiles'
 * cut edges in with it.
 *
 * The diamond is inset two units from the viewBox so a stroke centred on the
 * path still lands inside the box — at 4 units wide, half of it hangs outside
 * the line it is drawn on, and on the box edge that half would be clipped.
 */
export function FeatherOrnament({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5 shrink-0", className)}
    >
      <path d="M32 2 L62 32 L32 62 L2 32 Z" />
      <path d="M32 57 L32 21" />
      <path d="M32 57 L18 35" />
      <path d="M32 57 L46 35" />
    </svg>
  );
}
