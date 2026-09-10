import { APPLICANT_BASE, AUTH_BASE } from "./core/config";
import { apiPost } from "./core/request";
import {
  type Audience,
  type TokenPair,
  clearSession,
  readTokenPair,
  storeSession,
} from "./core/tokens";

/**
 * Sign-up and sign-in are the *same* endpoint.
 *
 * `POST /api/applicant/SaveHrAppUser` creates the account when the register
 * number is new and simply signs the applicant in when it already exists,
 * returning `access_token` / `refresh_token` either way. There is no separate
 * login route in the Postman collection.
 *
 * `mobilephone` doubles as the password: it is the initial credential, and
 * after `account.changePassword()` it carries the new one.
 */

export type SignUpInput = {
  lastname: string;
  firstname: string;
  regno: string;
  email: string;
  /** Phone number on first sign-up; the password on every sign-in after that. */
  mobilephone: string;
};

export type SignInInput = {
  regno: string;
  /** The password — the phone number until the applicant changes it. */
  mobilephone: string;
};

async function authenticate(body: unknown): Promise<TokenPair> {
  const retdata = await apiPost<unknown>(`${APPLICANT_BASE}/SaveHrAppUser`, body, {
    skipAuth: true,
  });

  const pair = readTokenPair(retdata);
  if (!pair) {
    throw new Error("Нэвтрэх хариунд токен ирсэнгүй.");
  }

  storeSession(pair, "applicant");
  return pair;
}

/** Create an account (and sign in). */
export function signUp(input: SignUpInput) {
  return authenticate(input);
}

/**
 * Sign in an existing applicant. The endpoint wants the full body, so the
 * name and email fields are sent empty — the register number and password are
 * what identify the account.
 */
export function signIn(input: SignInInput) {
  return authenticate({
    lastname: "",
    firstname: "",
    email: "",
    regno: input.regno,
    mobilephone: input.mobilephone,
  });
}

/**
 * Documented in the endpoint reference but never exercised by the collection;
 * the 401 interceptor calls it before giving up on a session.
 */
export function refresh(refreshToken: string) {
  return apiPost<unknown>(`${AUTH_BASE}/refresh-token`, { refreshToken }).then((retdata) => {
    const pair = readTokenPair(retdata);
    if (!pair) throw new Error("Refresh did not return a token.");
    storeSession(pair, "applicant");
    return pair;
  });
}

/** Local sign-out: the collection documents no server-side logout. */
export function signOut(audience: Audience = "applicant") {
  clearSession(audience);
}
