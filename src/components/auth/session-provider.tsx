"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { clearSession } from "@/lib/api/core/tokens";
import { getProfile, type ApplicantProfile } from "@/lib/api/profile";

/**
 * Client-side applicant session.
 *
 * Clerk decides who is signed in: `status` follows Clerk's `isSignedIn`. The
 * profile comes from `/api/me/get` (D1, keyed by the Clerk email) and is
 * fetched once and shared, because it already carries the name, the photo and
 * the completion percentages every account screen needs. No applicant token is
 * stored in the browser; the admin token tier (`core/tokens.ts`) is separate.
 *
 * `refresh()` resolves only after the new profile has been handed to React, so
 * a caller that awaits it and then navigates sees the updated state.
 */

type SessionValue = {
  status: "loading" | "authenticated" | "anonymous";
  profile: ApplicantProfile | null;
  /** Signed in, the read finished, and it failed (profile stays null). */
  profileFailed: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
};

const SessionContext = React.createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
  return context;
}

/** The profile, or null when it cannot be read right now. */
async function readProfile(): Promise<ApplicantProfile | null> {
  try {
    return await getProfile();
  } catch {
    // A failed read must not sign anyone out; Clerk owns that.
    return null;
  }
}

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Tagged with the Clerk user it belongs to, so another user's (or a
  // signed-out) session never shows it.
  const [loaded, setLoaded] = React.useState<{
    userId: string;
    profile: ApplicantProfile | null;
  } | null>(null);
  const profile = isSignedIn && loaded?.userId === userId ? loaded.profile : null;
  const profileFailed = !!isSignedIn && loaded?.userId === userId && loaded.profile === null;

  const status: SessionValue["status"] = !isLoaded
    ? "loading"
    : isSignedIn
      ? "authenticated"
      : "anonymous";

  // Only the newest read may commit: a slow earlier read must not put an old
  // profile back after sign-out or a newer save.
  const generation = React.useRef(0);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = React.useCallback(async (owner: string) => {
    const ticket = (generation.current += 1);
    const next = await readProfile();
    if (!mounted.current || ticket !== generation.current) return;
    setLoaded({ userId: owner, profile: next });
  }, []);

  React.useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) {
      void load(userId);
      return;
    }
    // Signed out: invalidate any read still in flight.
    generation.current += 1;
  }, [isLoaded, isSignedIn, userId, load]);

  const refresh = React.useCallback(async () => {
    if (isSignedIn && userId) await load(userId);
  }, [isSignedIn, userId, load]);

  const signOut = React.useCallback(() => {
    generation.current += 1;
    // Drop any applicant token an older build left in localStorage.
    clearSession("applicant");
    setLoaded(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value = React.useMemo<SessionValue>(
    () => ({ status, profile, profileFailed, refresh, signOut }),
    [status, profile, profileFailed, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

/** Full name, falling back to the register number. */
export function displayName(profile: ApplicantProfile | null): string {
  if (!profile) return "";
  const full = [profile.lastname, profile.firstname].filter(Boolean).join(" ");
  return [full, profile.regno].find(Boolean) ?? "";
}
