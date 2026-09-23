/**
 * The sign-in decision, with no cookies and no `next/headers` in sight.
 *
 * Everything that decides whether someone may in is here; `actions.ts` does
 * the parts only a server action can do (read the form, set the cookie,
 * redirect). That split is what lets this be tested against a real Postgres
 * without a request.
 *
 * ## One message, and one cost
 *
 * "No such email", "wrong password" and "this account is deactivated" all
 * return `SIGN_IN_FAILED` — the same Mongolian sentence, byte for byte. A
 * message that distinguished them would answer, for anyone who asks, whether
 * an address has an account here.
 *
 * The same is true of *time*, which is why the not-found branch verifies the
 * password against a decoy hash and throws the result away. Without it an
 * unknown address is refused in about a millisecond and a known one in about
 * seventeen, and that difference is the same oracle as a second message,
 * readable by anyone with a stopwatch. The decoy is a real argon2id hash with
 * the real parameters, so the work — and therefore the delay — is the work a
 * genuine verification does.
 *
 * ## Two brakes
 *
 * `./rate-limit` holds a hard refusal per address and a delay per email. The
 * split matters: the address half is armed only when the address is
 * trustworthy, and the email half slows wrong passwords down without ever
 * refusing a right one, so nobody can lock an admin out by failing on their
 * behalf. The reasoning is in that file.
 *
 * ## The fallback
 *
 * If `app_user` is completely empty, the old `ADMIN_PASSWORD` login still
 * works, and logs a warning every time it is used. A fresh deployment that has
 * not run `bun run user:create` yet would otherwise have no way in at all —
 * including no way in to create the first account. The moment one row exists,
 * this path is closed: the check is "the table is empty", not "this email is
 * unknown", so a real account's address can never fall through to it.
 */
import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

import {
  clearAddressFailures,
  clearEmailFailures,
  isAddressLockedOut,
  recordAddressFailure,
  recordEmailFailure,
  throttleDelayMs,
  wait as realWait,
} from "./rate-limit";
import { adminLoginAvailable, verifyAdminPassword } from "./session";
import {
  type AdminIdentity,
  findStaffByEmail,
  identityOf,
  purgeExpiredSessions,
  staffExists,
  startSession,
} from "./store";

/**
 * A real argon2id hash, of a passphrase no account has, verified against on
 * the not-found branch purely to spend the same time a real check spends.
 *
 * Generated once per process rather than written down as a literal. A hash in
 * the source would be a high-entropy string the secret scanner reads as a
 * leaked credential — and while it is neither secret nor a credential, a
 * decoy that is freshly random on every boot is strictly better: there is
 * nothing about it to precompute, and nothing to recognise in a diff.
 *
 * The work starts at import and is awaited only where it is used, so the
 * first unknown address does not pay for generating it. If it ever fails, the
 * branch falls back to an unusable string: `verifyPassword` returns false for
 * a malformed hash, which loses the timing cover but not the refusal.
 */
const decoyHash: Promise<string> = hashPassword(`decoy.${randomBytes(24).toString("hex")}`).catch(
  (error: unknown) => {
    console.error("[admin] could not prepare the decoy hash", error);
    return "not-a-hash";
  },
);

/** The one failure message. Do not add a second one. */
export const SIGN_IN_FAILED = "И-мэйл эсвэл нууц үг буруу байна.";

/** The address is refused outright. Not about the credentials, so its own line. */
export const SIGN_IN_RATE_LIMITED =
  "Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.";

/** No staff account and no ADMIN_PASSWORD: a misconfiguration, not a refusal. */
export const SIGN_IN_UNAVAILABLE =
  "Админ нэвтрэлт тохируулаагүй байна. Ажилтны бүртгэл үүсгэнэ үү (docs/postgres.md).";

export type SignInInput = {
  email: string;
  password: string;
  /**
   * The caller's address, or **null when there is no trustworthy one** — which
   * is the default, because a forwarded header is written by whoever is
   * talking to us. Null disarms the per-address refusal; it never weakens the
   * per-email throttle. See `clientIp` in the login action.
   */
  ip: string | null;
  now?: Date;
  /** Injected by the tests so a throttled answer does not really sleep. */
  wait?: (ms: number) => Promise<void>;
};

export type SignInOutcome =
  /** A real account: `token` goes in the cookie, the row is already written. */
  | { ok: true; kind: "session"; token: string; expiresAt: Date; user: AdminIdentity }
  /** The empty-table fallback: the caller sets the legacy HMAC cookie instead. */
  | { ok: true; kind: "admin-password" }
  | { ok: false; message: string };

/**
 * True when there is any way to sign in at all — used by the login page to
 * tell "your password is wrong" apart from "this deployment has no door".
 */
export async function signInAvailable(): Promise<boolean> {
  return (await staffExists()) || adminLoginAvailable();
}

export async function signIn({
  email,
  password,
  ip,
  now = new Date(),
  wait = realWait,
}: SignInInput): Promise<SignInOutcome> {
  const address = email.trim().toLowerCase();
  const at = now.getTime();

  // Only a trustworthy address can refuse anyone. A spoofable one would hand
  // an attacker the power to lock out whoever they chose.
  if (ip !== null && isAddressLockedOut(ip, at)) {
    return { ok: false, message: SIGN_IN_RATE_LIMITED };
  }

  // Slowed down, never refused: the password below is still checked, and a
  // correct one still signs in.
  const delay = throttleDelayMs(address, at);
  if (delay > 0) await wait(delay);

  if (!address || !password) return refuse(address, ip, at);

  const user = await findStaffByEmail(address);

  if (!user) {
    // No row for this address. Only if there are no rows *at all* does the
    // old shared password still open the door — see the note at the top.
    if (!(await staffExists())) return fallback(password, address, ip, at);

    // Thrown away. It exists so this branch costs what the branch below costs.
    await verifyPassword(await decoyHash, password);
    return refuse(address, ip, at);
  }

  // Verified before the `is_active` check, so a deactivated account costs the
  // same work as a live one and the two are not distinguishable by timing.
  const correct = await verifyPassword(user.passwordHash, password);
  if (!correct || !user.isActive) return refuse(address, ip, at);

  clearEmailFailures(address);
  if (ip !== null) clearAddressFailures(ip);
  // The one moment we are certainly touching this table anyway.
  await purgeExpiredSessions(now);

  const { token, expiresAt } = await startSession(user.id, now);
  return { ok: true, kind: "session", token, expiresAt, user: identityOf(user) };
}

/** One failure, counted on both brakes, answered with the one message. */
function refuse(address: string, ip: string | null, at: number): SignInOutcome {
  recordEmailFailure(address, at);
  if (ip !== null) recordAddressFailure(ip, at);
  return { ok: false, message: SIGN_IN_FAILED };
}

function fallback(
  password: string,
  address: string,
  ip: string | null,
  at: number,
): SignInOutcome {
  if (!adminLoginAvailable()) {
    return { ok: false, message: SIGN_IN_UNAVAILABLE };
  }

  if (!verifyAdminPassword(password)) return refuse(address, ip, at);

  // Loud on purpose, and on every use rather than once: this is a deployment
  // running without staff accounts, and the line in the log is what tells the
  // operator to create one and close the path.
  console.warn(
    "[admin] signed in with ADMIN_PASSWORD because app_user is empty. " +
      "Create a staff account (bun run user:create) — see docs/postgres.md.",
  );

  clearEmailFailures(address);
  if (ip !== null) clearAddressFailures(ip);
  return { ok: true, kind: "admin-password" };
}
