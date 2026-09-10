import { AUTH_BASE } from "./core/config";
import { apiPost } from "./core/request";
import {
  type Audience,
  type TokenPair,
  clearSession,
  readTokenPair,
  storeSession,
} from "./core/tokens";

/**
 * `/api/applicant/auth` — 4 endpoints.
 *
 * Login and refresh both hand back a JWT pair; every function here stores it,
 * so callers never touch the token store directly.
 */

export type ApplicantCredentials = {
  regNo: string;
  /**
   * Named `mobile` by the backend, but it carries the password — see the
   * endpoint reference. Kept under the backend's name at the wire boundary
   * and renamed for the UI in `signIn` below.
   */
  mobile: string;
};

export type AdminCredentials = {
  userid: string;
  password: string;
};

async function login(
  path: string,
  body: unknown,
  audience: Audience,
): Promise<TokenPair> {
  const payload = await apiPost<unknown>(path, body, { skipAuth: true });
  const pair = readTokenPair(payload);
  if (!pair) {
    throw new Error("The login response did not contain an access token.");
  }
  storeSession(pair, audience);
  return pair;
}

/** POST /api/applicant/auth/login */
export function signIn(input: { registerNumber: string; password: string }) {
  const body: ApplicantCredentials = {
    regNo: input.registerNumber,
    mobile: input.password,
  };
  return login(`${AUTH_BASE}/login`, body, "applicant");
}

/** POST /api/applicant/auth/refresh-token — normally driven by the 401 interceptor. */
export function refresh(refreshToken: string) {
  return login(`${AUTH_BASE}/refresh-token`, { refreshToken }, "applicant");
}

/** POST /api/applicant/auth/adminUserLogin */
export function signInAsAdmin(body: AdminCredentials) {
  return login(`${AUTH_BASE}/adminUserLogin`, body, "admin");
}

/** POST /api/applicant/auth/admin-user-refresh-token */
export function refreshAdmin(refreshToken: string) {
  return login(`${AUTH_BASE}/admin-user-refresh-token`, { refreshToken }, "admin");
}

/** Local sign-out: the reference documents no server-side logout. */
export function signOut(audience: Audience = "applicant") {
  clearSession(audience);
}
