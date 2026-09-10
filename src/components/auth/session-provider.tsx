"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { auth, isSignedIn, isUnauthorized, profile as profileApi } from "@/lib/api";
import type { ApplicantProfile } from "@/lib/api/profile";

/**
 * Client-side session.
 *
 * Tokens live in `localStorage` (see `api/core/tokens.ts`), so the signed-in
 * surfaces are client-rendered; the public job pages stay on the server.
 * The profile is fetched once and shared, because `/api/applicant/get` already
 * returns the name, the photo and the completion percentages every account
 * screen needs.
 */

type SessionValue = {
  status: "loading" | "authenticated" | "anonymous";
  profile: ApplicantProfile | null;
  refresh: () => Promise<void>;
  signOut: () => void;
};

const SessionContext = React.createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
  return context;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<SessionValue["status"]>("loading");
  const [profile, setProfile] = React.useState<ApplicantProfile | null>(null);

  const [reloadToken, setReloadToken] = React.useState(0);

  /**
   * Resolves the next session state without touching React state, so the
   * effect below can commit it in one go rather than writing part of it
   * synchronously on the way through.
   */
  const read = React.useCallback(async (): Promise<{
    status: SessionValue["status"];
    profile: ApplicantProfile | null;
  }> => {
    if (!isSignedIn()) return { status: "anonymous", profile: null };

    try {
      return { status: "authenticated", profile: await profileApi.getProfile() };
    } catch (error) {
      if (isUnauthorized(error)) {
        auth.signOut();
        return { status: "anonymous", profile: null };
      }
      // A transient failure should not sign anyone out.
      return { status: "authenticated", profile: null };
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    read().then((next) => {
      if (cancelled) return;
      setProfile(next.profile);
      setStatus(next.status);
    });

    return () => {
      cancelled = true;
    };
  }, [read, reloadToken]);

  const load = React.useCallback(async () => {
    setReloadToken((token) => token + 1);
  }, []);

  const signOut = React.useCallback(() => {
    auth.signOut();
    setProfile(null);
    setStatus("anonymous");
    router.push("/");
    router.refresh();
  }, [router]);

  const value = React.useMemo<SessionValue>(
    () => ({ status, profile, refresh: load, signOut }),
    [status, profile, load, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Full name, falling back to the register number. */
export function displayName(profile: ApplicantProfile | null): string {
  if (!profile) return "";
  const parts = [profile.lastname, profile.firstname].filter(Boolean);
  return parts.join(" ") || (profile.regno ?? "");
}
