/**
 * Applicant session storage.
 *
 * The endpoint reference has two token tiers — an applicant JWT from
 * `/auth/login` and an admin JWT from `/auth/adminUserLogin` — each with its
 * own refresh endpoint. Both are kept here so the axios interceptor has one
 * place to ask for "the token for this audience".
 *
 * NOTE: tokens live in `localStorage`, which means they are readable by any
 * script on the page and invisible to Server Components. That is why every
 * authenticated call in this layer is a client-side call. Moving to an
 * httpOnly cookie set by a Next route handler would let the server render
 * authenticated pages too; this module is the only thing that would change.
 */

export type Audience = "applicant" | "admin";

const KEYS: Record<Audience, { access: string; refresh: string }> = {
  // Kept as-is so any token already stored by an earlier build still works.
  applicant: { access: "shunkhlai.token", refresh: "shunkhlai.refreshToken" },
  admin: { access: "shunkhlai.adminToken", refresh: "shunkhlai.adminRefreshToken" },
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string | null;
};

const listeners = new Set<(audience: Audience) => void>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Private-mode browsers can throw on access rather than on read.
    return null;
  }
}

export function readAccessToken(audience: Audience = "applicant"): string | null {
  return storage()?.getItem(KEYS[audience].access) ?? null;
}

export function readRefreshToken(audience: Audience = "applicant"): string | null {
  return storage()?.getItem(KEYS[audience].refresh) ?? null;
}

export function storeSession(pair: TokenPair, audience: Audience = "applicant"): void {
  const store = storage();
  if (!store) return;

  store.setItem(KEYS[audience].access, pair.accessToken);
  if (pair.refreshToken) {
    store.setItem(KEYS[audience].refresh, pair.refreshToken);
  }
  notify(audience);
}

export function clearSession(audience: Audience = "applicant"): void {
  const store = storage();
  if (!store) return;

  store.removeItem(KEYS[audience].access);
  store.removeItem(KEYS[audience].refresh);
  notify(audience);
}

export function isSignedIn(audience: Audience = "applicant"): boolean {
  return readAccessToken(audience) !== null;
}

/** Subscribe to sign-in/sign-out so React state can follow the session. */
export function onSessionChange(listener: (audience: Audience) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(audience: Audience) {
  for (const listener of listeners) listener(audience);
}

/**
 * Pulls a token pair out of a login/refresh response.
 *
 * The endpoint reference documents request bodies but not response shapes, so
 * this accepts the spellings a .NET JWT endpoint realistically returns. Once a
 * real response is in hand, narrow this to the one true shape.
 */
export function readTokenPair(payload: unknown): TokenPair | null {
  if (typeof payload !== "object" || payload === null) return null;

  const source = payload as Record<string, unknown>;
  const nested = source.data ?? source.result ?? source;
  const record = (typeof nested === "object" && nested !== null ? nested : source) as Record<
    string,
    unknown
  >;

  const accessToken =
    pickString(record, "accessToken") ??
    pickString(record, "access_token") ??
    pickString(record, "token") ??
    pickString(record, "jwtToken");

  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken:
      pickString(record, "refreshToken") ?? pickString(record, "refresh_token") ?? null,
  };
}

function pickString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
