"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { auth, isSignedIn, isUnauthorized, onSessionChange, profile as profileApi } from "@/lib/api";
import type { ApplicantProfile } from "@/lib/api/profile";

/**
 * Client-side session.
 *
 * Tokens live in `localStorage` (see `api/core/tokens.ts`), so the signed-in
 * surfaces are client-rendered; the public job pages stay on the server.
 * The profile is fetched once and shared, because `/api/applicant/get` already
 * returns the name, the photo and the completion percentages every account
 * screen needs.
 *
 * Two things this has to get right, because `/account` redirects anyone whose
 * status is `anonymous`:
 *
 *   - `refresh()` must not resolve until the new status has been handed to
 *     React. `AuthForm` awaits it and then navigates; if it resolves early the
 *     guard sees the pre-sign-in `anonymous` and bounces the user back to the
 *     login form they just submitted.
 *   - the token store is written from outside React too — the 401 interceptor
 *     in `api/core/client.ts` and an expired token both clear it — so the provider
 *     subscribes to `onSessionChange` rather than assuming it is the only
 *     writer.
 */

type SessionValue = {
  status: "loading" | "authenticated" | "anonymous";
  profile: ApplicantProfile | null;
  refresh: () => Promise<void>;
  signOut: () => void;
};

type SessionState = {
  status: SessionValue["status"];
  profile: ApplicantProfile | null;
};

const ANONYMOUS: SessionState = { status: "anonymous", profile: null };

const SessionContext = React.createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
  return context;
}

/** A 401 means the session is gone; anything else is worth keeping it for. */
function afterProfileError(error: unknown): SessionState {
  if (isUnauthorized(error)) {
    auth.signOut();
    return ANONYMOUS;
  }
  // A transient failure should not sign anyone out.
  return { status: "authenticated", profile: null };
}

/** Resolves the next session state without touching React state. */
async function readSession(): Promise<SessionState> {
  if (!isSignedIn()) return ANONYMOUS;

  try {
    return { status: "authenticated", profile: await profileApi.getProfile() };
  } catch (error) {
    return afterProfileError(error);
  }
}

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [status, setStatus] = React.useState<SessionValue["status"]>("loading");
  const [profile, setProfile] = React.useState<ApplicantProfile | null>(null);

  // Only the newest read may commit. Sign-out and a re-read can otherwise be
  // in flight together, and a slow earlier read would put the old profile
  // back on screen after the session ended. `mounted` is the other half of
  // what the old per-effect `cancelled` flag did: the counter alone would
  // still let a late read commit to an unmounted provider.
  const generation = React.useRef(0);
  const mounted = React.useRef(false);

  const load = React.useCallback(async () => {
    const ticket = (generation.current += 1);
    const next = await readSession();
    if (!mounted.current || ticket !== generation.current) return;

    setProfile(next.profile);
    setStatus(next.status);
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
    };
  }, [load]);

  // The token store has writers outside React — sign-in, the 401 interceptor
  // and the expiry check all go through `core/tokens.ts`.
  React.useEffect(
    () =>
      onSessionChange((audience) => {
        if (audience === "applicant") void load();
      }),
    [load],
  );

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
};

/** Full name, falling back to the register number. */
export function displayName(profile: ApplicantProfile | null): string {
  if (!profile) return "";
  const full = [profile.lastname, profile.firstname].filter(Boolean).join(" ");
  return [full, profile.regno].find(Boolean) ?? "";
}
