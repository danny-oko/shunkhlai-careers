import { APPLICANT_BASE, hasLiveBackend } from "./core/config";
import { apiPost } from "./core/request";
import {
  type Audience,
  type TokenPair,
  clearSession,
  readTokenPair,
  storeSession,
} from "./core/tokens";

/**
 * Sign-up and sign-in.
 *
 * Sign-up is `POST /api/applicant/SaveHrAppUser` (`01. Бүртгүүлэх`) — a
 * create-or-update that needs the real name/email. Sign-in against a live
 * backend is `POST /api/applicant/auth/login` (`{ regNo, mobile }`), which
 * authenticates on register number + password only and touches no other fields
 * — see `signIn` for why that distinction matters. Either answer carries
 * `access_token` / `refresh_token` (bare for `auth/login`, under `retdata` for
 * `SaveHrAppUser`). Wrong credentials come back with
 * "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!".
 *
 * `mobilephone` doubles as the password: it is the initial credential, and
 * after `account.changePassword()` it carries the new one.
 *
 * There is no logout call, and refresh is not wired here: an expired token ends
 * the session and the applicant signs in again.
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

function completeSession(retdata: unknown): TokenPair {
  // `auth/login` returns the token fields bare (no envelope) and `SaveHrAppUser`
  // returns them under `retdata`; `unwrap()` passes the bare shape through, so
  // `readTokenPair` handles both.
  const pair = readTokenPair(retdata);
  if (!pair) {
    throw new Error("Нэвтрэх хариунд токен ирсэнгүй.");
  }

  storeSession(pair, "applicant");
  return pair;
}

/** `01. Бүртгүүлэх` — create the account and sign in. Real names are required. */
export async function signUp(input: SignUpInput): Promise<TokenPair> {
  const retdata = await apiPost<unknown>(`${APPLICANT_BASE}/SaveHrAppUser`, input, {
    skipAuth: true,
  });
  return completeSession(retdata);
}

/**
 * `02. Нэвтрэх` — sign in.
 *
 * Against a LIVE backend this uses the dedicated `POST /api/applicant/auth/login`
 * (`{ regNo, mobile }`), which authenticates on register number + password
 * ONLY. This is deliberate: `SaveHrAppUser` is a create-or-update, and handed
 * the empty name/email a sign-in form has, it would blank the applicant's stored
 * name and email on the real service. `auth/login` carries no such fields.
 *
 * The mock backend has no `auth/login` route, and its `SaveHrAppUser` returns
 * early for a known account (so no blanking there); the mock therefore keeps the
 * original call, preserving the offline dev/loop workflow.
 */
export async function signIn(input: SignInInput): Promise<TokenPair> {
  if (hasLiveBackend()) {
    const retdata = await apiPost<unknown>(
      `${APPLICANT_BASE}/auth/login`,
      { regNo: input.regno, mobile: input.mobilephone },
      { skipAuth: true },
    );
    return completeSession(retdata);
  }

  const retdata = await apiPost<unknown>(
    `${APPLICANT_BASE}/SaveHrAppUser`,
    {
      lastname: "",
      firstname: "",
      regno: input.regno,
      email: "",
      mobilephone: input.mobilephone,
    },
    { skipAuth: true },
  );
  return completeSession(retdata);
}

/** Local sign-out: the collection documents no server-side logout. */
export function signOut(audience: Audience = "applicant") {
  clearSession(audience);
}
