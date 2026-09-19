/**
 * Applicant session storage.
 *
 * The applicant token comes from `SaveHrAppUser` (see `auth.ts`); the admin
 * tier is kept alongside it for the CMS calls in `system.ts`, so the axios
 * interceptor has one place to ask for "the token for this audience".
 *
 * Nothing refreshes a token — the Postman collection never does. A token past
 * its JWT `exp` reads as absent and its session is cleared, so the app sends
 * the applicant to sign in again instead of firing calls the server will
 * refuse.
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
  const token = readKey(KEYS[audience].access);
  if (!isExpired(token)) return token;

  clearSession(audience);
  return null;
}

/**
 * Reads `exp` (seconds since the epoch) from a JWT payload.
 *
 * The login response also carries `expires_at`, but as a local time with no
 * zone ("2026-09-08T12:00:00"), which a browser outside the server's zone
 * would misread. `exp` is unambiguous. A token that is not a JWT — the mock
 * backend's, say — has no expiry here and lives until the server says 401.
 */
export function tokenExpiry(token: string): number | null {
  const exp = readClaims(token.split(".")[1] ?? "").exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

function readClaims(base64url: string): { exp?: unknown } {
  try {
    return JSON.parse(atob(base64url.replaceAll("-", "+").replaceAll("_", "/"))) ?? {};
  } catch {
    return {};
  }
}

function isExpired(token: string | null): boolean {
  const expiry = token ? tokenExpiry(token) : null;
  return expiry !== null && expiry <= Date.now();
}

export function readRefreshToken(audience: Audience = "applicant"): string | null {
  return readKey(KEYS[audience].refresh);
}

function readKey(key: string): string | null {
  return storage()?.getItem(key) ?? null;
}

export function storeSession(pair: TokenPair, audience: Audience = "applicant"): void {
  const store = storage();
  if (!store) return;

  store.setItem(KEYS[audience].access, pair.accessToken);
  writeIfPresent(store, KEYS[audience].refresh, pair.refreshToken);
  notify(audience);
}

/**
 * The login response may omit the refresh token. The collection stores it but
 * never sends it anywhere; an absent value leaves what is already there alone.
 */
function writeIfPresent(store: Storage, key: string, value: string | null): void {
  if (value) store.setItem(key, value);
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
 * Pulls a token pair out of an already-unwrapped login response.
 *
 * `SaveHrAppUser` answers with `retdata.access_token` / `retdata.refresh_token`
 * (see the collection's own test script, which stores exactly these).
 *
 * The argument is `retdata`, never the envelope around it. Stripping the
 * envelope — and refusing a non-zero `rettype` while doing so — is `unwrap()`'s
 * job in `request.ts`; every caller goes through it first.
 */
export function readTokenPair(retdata: unknown): TokenPair | null {
  const record = asRecord(retdata);
  if (!record) return null;

  const accessToken = pickEither(record, "access_token", "accessToken");
  if (!accessToken) return null;

  return { accessToken, refreshToken: pickEither(record, "refresh_token", "refreshToken") };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

/** The service spells these snake_case; some payloads use camelCase. */
function pickEither(record: Record<string, unknown>, snake: string, camel: string): string | null {
  return pickString(record, snake) ?? pickString(record, camel);
}

function pickString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
