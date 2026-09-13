import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Intrinsic sizes of the artwork in `public/brand`. Passing them keeps the
 * browser reserving the right box before the file lands, which matters for the
 * header lockup — the opening loader measures that box to aim its flight.
 */
const MARK = { width: 1847, height: 621 };
const LOCKUP = { width: 1847, height: 1149 };

/**
 * The eagle on its own, for lockups that set the name in type beside it.
 *
 * One file for both themes: the bird is the same orange on light and on dark,
 * only the wordmark under it changes colour.
 *
 * Size it by height (`h-6 w-auto`) — the width follows the artwork.
 */
export function BrandMark({
  className,
  sizes,
  priority,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden
      width={MARK.width}
      height={MARK.height}
      sizes={sizes}
      priority={priority}
      className={cn("w-auto", className)}
    />
  );
}

/**
 * The full stacked lockup — eagle over the Шунхлай wordmark.
 *
 * Two cuts of the same drawing, because the wordmark is navy on light grounds
 * and white on dark ones. Both are rendered and one is hidden by the theme
 * class, so the right one is on screen from the first paint rather than after
 * a client-side theme read.
 */
export function BrandLockup({
  className,
  sizes,
  priority,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const shared = {
    width: LOCKUP.width,
    height: LOCKUP.height,
    sizes,
    priority,
  };

  return (
    <>
      <Image
        {...shared}
        alt="Шунхлай"
        src="/brand/logo-lockup.png"
        className={cn("w-auto dark:hidden", className)}
      />
      {/* The same name, so only one of the pair is announced. */}
      <Image
        {...shared}
        alt=""
        aria-hidden
        src="/brand/logo-lockup-dark.png"
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
