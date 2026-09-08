import { cn } from "@/lib/utils";

/**
 * Brandbook 1.15 - "График элемент-2 (бэлгэдэл хээ)".
 *
 * The bird-feather motif: a diamond outline with a three-line fan rising from
 * its lower vertex, tessellated edge to edge. The brandbook uses it as a
 * near-invisible ground on white and tone-on-tone on orange; both are served
 * here by `tone`.
 */
export function FeatherLattice({
  className,
  tone = "ink",
  animate = true,
}: {
  className?: string;
  tone?: "ink" | "brand";
  animate?: boolean;
}) {
  const stroke =
    tone === "brand"
      ? "color-mix(in oklab, var(--brand) 34%, transparent)"
      : "color-mix(in oklab, var(--foreground) 12%, transparent)";

  // Encoded once as a data URI so the tile repeats via background-image and
  // can be scrolled by a single background-position animation.
  const tile = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
      `<g fill="none" stroke="${stroke}" stroke-width="1" stroke-linecap="round">` +
      `<path d="M32 0 L64 32 L32 64 L0 32 Z"/>` +
      `<path d="M32 62 L32 18"/>` +
      `<path d="M32 62 L13 33"/>` +
      `<path d="M32 62 L51 33"/>` +
      `</g></svg>`,
  );

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-repeat",
        animate && "brand-lattice",
        className,
      )}
      style={{ backgroundImage: `url("data:image/svg+xml,${tile}")` }}
    />
  );
}
