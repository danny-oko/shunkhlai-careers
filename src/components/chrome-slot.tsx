"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Paths that bring their own chrome.
 *
 * The admin newsroom is a tool, not a page of the site: it has its own bar,
 * its own sign-out and no marketing navigation. The site header and footer
 * are mounted once in the root layout, so this is the only place that can
 * take them away again for a subtree.
 */
const OWN_CHROME = ["/admin"];

/** True for `/admin` and everything under it — not for `/administration`. */
export function hasOwnChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  return OWN_CHROME.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

export function ChromeSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return hasOwnChrome(pathname) ? null : <>{children}</>;
}
