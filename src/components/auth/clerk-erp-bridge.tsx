"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { readAccessToken } from "@/lib/api/core/tokens";
import { storeSession, clearSession } from "@/lib/api/core/tokens";

export type ErpBridgeStatus = "idle" | "loading" | "ready" | "relink" | "error";

// Tiny module-level store so the UI (e.g. /account) can react to the bridge.
let bridgeStatus: ErpBridgeStatus = "idle";
// The 409 body's `reason`: "relink" = stored creds went bad; null = not linked yet.
let bridgeReason: "relink" | null = null;
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

function setBridgeReason(next: "relink" | null) {
  if (bridgeReason === next) return;
  bridgeReason = next;
  emit();
}

const getStatus = () => bridgeStatus;
const getReason = () => bridgeReason;
const getServerReason = (): "relink" | null => null;
const getServerStatus = (): ErpBridgeStatus => "idle";
const getAttempt = () => bridgeAttempt;
const getServerAttempt = () => 0;

/** Current state of the Clerk → ERP session bridge. */
export function useErpBridgeStatus(): ErpBridgeStatus {
  return React.useSyncExternalStore(subscribe, getStatus, getServerStatus);
}

/** Why the bridge is in "relink": "relink" = stored credentials unreadable. */
export function useErpBridgeReason(): "relink" | null {
  return React.useSyncExternalStore(subscribe, getReason, getServerReason);
}

/** Resets the bridge and asks it to fetch /api/erp/session again. */
export function retryErpSession() {
  bridgeStatus = "idle";
  bridgeReason = null;
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
 *   - Clerk signed in + NOT linked → status "relink"; /account renders the
 *                                   inline connect form (ErpConnectForm).
 *   - Clerk signed out           → clear the app session too.
 *
 * The user's regno/phone never reach the browser — only the short-lived access
 * token does, which matches the app's existing localStorage model.
 */
export function ClerkErpBridge() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Re-run on navigation so a cleared app session is re-established.
  const pathname = usePathname();
  const attempt = React.useSyncExternalStore(subscribe, getAttempt, getServerAttempt);

  React.useEffect(() => {
    if (!isLoaded) return;

    // Signed out of Clerk → make sure the app session is gone as well.
    if (!isSignedIn) {
      if (readAccessToken()) clearSession("applicant");
      setBridgeReason(null);
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
          // Not linked yet, or the stored creds need re-linking. /account
          // shows the connect form; the public site stays browsable.
          const body = (await res.json().catch(() => null)) as { reason?: string } | null;
          if (cancelled) return;
          setBridgeReason(body?.reason === "relink" ? "relink" : null);
          setBridgeStatus("relink");
          return;
        }
        if (!res.ok) {
          setBridgeStatus("error");
          return;
        }

        const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
        if (cancelled) return;
        if (data.accessToken) {
          setBridgeReason(null);
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
  }, [isLoaded, isSignedIn, userId, pathname, attempt]);

  return null;
}
