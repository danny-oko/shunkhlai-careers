"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { readAccessToken } from "@/lib/api/core/tokens";
import { storeSession, clearSession } from "@/lib/api/core/tokens";

/**
 * Bridges Clerk identity to the app's existing client session.
 *
 * Clerk owns who you are; the account UI still reads an ERP token from
 * localStorage (see api/core/tokens.ts). This component keeps the two in sync:
 *
 *   - Clerk signed in + linked   → fetch the ERP token from /api/erp/session
 *                                   and store it, so /account works.
 *   - Clerk signed in + NOT linked → send the user to /link to connect their
 *                                   recruitment profile.
 *   - Clerk signed out           → clear the app session too.
 *
 * The user's regno/phone never reach the browser — only the short-lived access
 * token does, which matches the app's existing localStorage model.
 */
export function ClerkErpBridge() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isLoaded) return;

    // Signed out of Clerk → make sure the app session is gone as well.
    if (!isSignedIn) {
      if (readAccessToken()) clearSession("applicant");
      return;
    }

    // Already have a valid app-session token → nothing to do.
    if (readAccessToken()) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/erp/session", { cache: "no-store" });
        if (cancelled) return;

        if (res.status === 409) {
          // Signed in but not linked yet. Only nudge to /link from protected
          // pages; let them browse the public site freely otherwise.
          if (pathname.startsWith("/account")) router.push("/link");
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
        if (data.accessToken) {
          storeSession(
            { accessToken: data.accessToken, refreshToken: data.refreshToken ?? null },
            "applicant"
          );
        }
      } catch {
        // Network hiccup — the effect re-runs on the next navigation.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, pathname, router]);

  return null;
}
