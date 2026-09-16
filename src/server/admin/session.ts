import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The admin gate.
 *
 * Deliberately *not* part of `src/lib/api/core/*`. That module is the transport
 * for the recruitment backend's two JWT tiers, and the newsroom is this app's
 * own content — the recruitment service has no news endpoints and no admin
 * login in the collection, so there is no token there to reuse. Inventing a
 * contract against a backend we cannot reach would be worse than a local gate
 * that is honest about being local.
 *
 * The session is a stateless signed cookie: `<expiry>.<hmac>`. There is no
 * server-side session table because there is only ever one admin, so a table
 * would buy nothing that rotating `ADMIN_PASSWORD` does not already buy —
 * changing the password changes the derived secret and invalidates every
 * cookie in the wild.
 *
 * When the real `/auth/adminUserLogin` endpoint exists, this is the only
 * module that changes: `verifyAdminPassword` becomes a call, and the cookie
 * carries the backend's JWT instead of an expiry.
 */

export const ADMIN_COOKIE = "shunkhlai.admin";

/** A working day. Long enough to write an article, short enough to matter. */
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

/**
 * The password nobody should ship.
 *
 * With no `ADMIN_PASSWORD` set, a development server would otherwise have no
 * way into `/admin` at all, which makes the feature untestable on a fresh
 * checkout. In production the same absence means the opposite: the gate is
 * shut and this value is never consulted.
 */
const DEV_PASSWORD = "shunkhlai-dev";

const isProduction = process.env.NODE_ENV === "production";

const configuredPassword = process.env.ADMIN_PASSWORD?.trim() || null;

/**
 * Resolved once at import, because it decides whether the gate exists at all
 * and re-reading it per request would let a mid-flight env change open it.
 */
const password: string | null =
  configuredPassword ?? (isProduction ? null : DEV_PASSWORD);

if (!configuredPassword && !isProduction) {
  console.warn(
    "[admin] ADMIN_PASSWORD is not set — /admin accepts the development " +
      `password "${DEV_PASSWORD}". See docs/newsroom.md.`,
  );
}

/**
 * Signing key.
 *
 * An explicit `ADMIN_SESSION_SECRET` wins. Without one it is derived from the
 * password, which gives two properties worth more here than a random key: a
 * cookie survives a server restart (a dev-server reload does not sign the
 * editor out mid-article), and rotating the password revokes every cookie
 * already issued. The random fallback only applies when there is no password
 * either — the gate is shut in that case, so the key is never used.
 */
const secret: Buffer = (() => {
  const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicit) return Buffer.from(explicit, "utf8");
  if (password) {
    return createHmac("sha256", password).update("shunkhlai.news.admin.v1").digest();
  }
  return randomBytes(32);
})();

export function adminLoginAvailable(): boolean {
  return password !== null;
}

/**
 * Constant-time password check.
 *
 * Both sides are hashed first so the comparison is always over two 32-byte
 * buffers. `timingSafeEqual` throws on a length mismatch, and an empty or
 * truncated password is exactly the input most likely to arrive — a throw
 * inside a server action answering "no" is a 500, not a rejection.
 */
export function verifyAdminPassword(input: string): boolean {
  if (password === null) return false;
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest();
  return timingSafeEqual(digest(input ?? ""), digest(password));
}

function sign(expiry: number): string {
  return createHmac("sha256", secret).update(`v1.${expiry}`).digest("base64url");
}

/** `nowMs` is injectable so the expiry cases are testable against a fixed clock. */
export function signAdminSession(nowMs: number = Date.now()): string {
  const expiry = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  return `${expiry}.${sign(expiry)}`;
}

/**
 * True only for a cookie this server signed, that has not expired.
 *
 * Every rejection path returns `false` rather than throwing: this runs in the
 * proxy, in a layout and in every server action, and each of those turns a
 * throw into an error page instead of a redirect to the login form.
 */
export function verifyAdminSession(
  value: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (password === null || !value) return false;

  const parts = value.split(".");
  if (parts.length !== 2) return false;

  const [rawExpiry, signature] = parts;

  // `Number()` accepts " 12", "0x10", "1e400" and "-1"; a stamp that round-trips
  // through those is a forgery attempt, not a stamp. Match the digits instead.
  if (!/^\d{1,15}$/u.test(rawExpiry)) return false;
  if (!signature) return false;

  const expected = sign(Number(rawExpiry));
  // Compared as bytes of equal length, so a truncated or padded signature is
  // rejected here rather than throwing inside `timingSafeEqual`.
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return false;
  }

  return Number(rawExpiry) * 1000 > nowMs;
}

/**
 * `path: "/admin"` is the point: the cookie is never attached to a request for
 * a public page, so no amount of caching or logging on `/news` can capture it.
 * The logout action has to clear it on the same path or the browser keeps it.
 */
export function adminCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/admin";
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    secure: isProduction,
    maxAge: SESSION_TTL_SECONDS,
  };
}
