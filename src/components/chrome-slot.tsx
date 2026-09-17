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

export function ChromeSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hasOwnChrome = OWN_CHROME.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );

  return hasOwnChrome ? null : <>{children}</>;
}
