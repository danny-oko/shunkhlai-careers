import Image from "next/image";

import { coverUrl, isOptimizableCover } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * A story's photograph.
 *
 * Covers are either served by a route handler or hosted elsewhere (Cloudinary)
 * rather than sitting in `public/`, so their intrinsic size is unknown at build
 * time — hence `fill` inside a box
 * whose aspect ratio the caller decides. The hairline around the frame is the
 * print convention: a photograph on newsprint is always ruled, which also
 * stops a light sky from bleeding into the paper ground.
 *
 * The crop is biased to the top of the frame rather than centred. Two reasons,
 * and they agree: a subject's face is almost always in the upper half, and the
 * brand key visuals this site currently has available carry their headline
 * type across the lower third — a centred crop of a tall one lands on the type
 * instead of on the picture. See `docs/newsroom.md` on replacing these with
 * real editorial photographs.
 *
 * A hosted cover goes through the optimiser when its host is in
 * `images.remotePatterns` (Cloudinary) and straight to the browser otherwise,
 * so an https address an editor pasted from any other host still shows.
 */
export function NewsCover({
  coverKey,
  alt,
  ratio = "3 / 2",
  sizes,
  priority = false,
  objectPosition = "50% 22%",
  className,
}: {
  coverKey: string | null;
  alt: string;
  ratio?: string;
  sizes: string;
  priority?: boolean;
  /** Override when a particular photograph needs a different crop. */
  objectPosition?: string;
  className?: string;
}) {
  const src = coverUrl(coverKey);

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border bg-muted",
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={!isOptimizableCover(src)}
          style={{ objectPosition }}
          className="object-cover"
        />
      ) : (
        /* No photograph yet. A ruled, empty plate is the honest answer — it
           holds the column's height so the grid does not reflow when one
           lands, and it says "no image" rather than faking one. */
        <div
          aria-hidden
          className="news-paper-grid absolute inset-0 flex items-center justify-center"
        >
          <span className="font-serif text-xs tracking-[0.3em] text-muted-foreground uppercase">
            Шунхлай
          </span>
        </div>
      )}
    </div>
  );
}
