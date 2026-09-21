"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { readAccessToken } from "@/lib/api/core/tokens";
import { storeSession, clearSession } from "@/lib/api/core/tokens";

export type ErpBridgeStatus = "idle" | "loading" | "ready" | "relink" | "error";

// Tiny module-level store so the UI (e.g. /account) can react to the bridge.
let bridgeStatus: ErpBridgeStatus = "idle";
let bridgeAttempt = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setBridgeStatus(next: ErpBridgeStatus) {
  if (bridgeStatus === next) return;
  bridgeStatus = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getStatus = () => bridgeStatus;
const getServerStatus = (): ErpBridgeStatus => "idle";
const getAttempt = () => bridgeAttempt;
const getServerAttempt = () => 0;

/** Current state of the Clerk → ERP session bridge. */
export function useErpBridgeStatus(): ErpBridgeStatus {
  return React.useSyncExternalStore(subscribe, getStatus, getServerStatus);
}

/** Resets the bridge and asks it to fetch /api/erp/session again. */
export function retryErpSession() {
  bridgeStatus = "idle";
  bridgeAttempt += 1;
  emit();
}

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
  const attempt = React.useSyncExternalStore(subscribe, getAttempt, getServerAttempt);

  React.useEffect(() => {
    if (!isLoaded) return;

    // Signed out of Clerk → make sure the app session is gone as well.
    if (!isSignedIn) {
      if (readAccessToken()) clearSession("applicant");
      setBridgeStatus("idle");
      return;
    }

    // Already have a valid app-session token → nothing to do.
    if (readAccessToken()) {
      setBridgeStatus("ready");
      return;
    }

    let cancelled = false;
    setBridgeStatus("loading");
    (async () => {
      try {
        const res = await fetch("/api/erp/session", { cache: "no-store" });
        if (cancelled) return;

        if (res.status === 409) {
          // Not linked yet, or the stored creds need re-linking. Only nudge to
          // /link from protected pages; let them browse the public site freely.
          setBridgeStatus("relink");
          if (pathname.startsWith("/account")) router.push("/link");
          return;
        }
        if (!res.ok) {
          setBridgeStatus("error");
          return;
        }

        const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
        if (cancelled) return;
        if (data.accessToken) {
          storeSession(
            { accessToken: data.accessToken, refreshToken: data.refreshToken ?? null },
            "applicant"
          );
          setBridgeStatus("ready");
        } else {
          setBridgeStatus("error");
        }
      } catch {
        // Network hiccup — surfaced so the UI can offer a retry; the effect
        // also re-runs on the next navigation.
        if (!cancelled) setBridgeStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, pathname, router, attempt]);

  return null;
}
