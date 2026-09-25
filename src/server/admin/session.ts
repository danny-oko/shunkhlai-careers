/**
 * The `ADMIN_PASSWORD` login — now the fallback, not the front door.
 *
 * Staff sign in with an email and a password against `app_user`, and their
 * session is a row in `admin_session` (see `./store`). Everything in this file
 * is kept for one case: a deployment whose `app_user` table is still empty,
 * which would otherwise have no way in at all — including no way in to create
 * the first account. `signIn` in `./sign-in` reaches for it only then, and
 * warns when it does.
 *
 * The cookie name and the eight-hour TTL are shared by both doors; the stamp
 * this file signs and the opaque token the new sessions use are told apart by
 * shape, in `adminCookiePlausible` below and in `./guard`.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { looksLikeSessionToken } from "./tokens";

export const ADMIN_COOKIE = "shunkhlai.admin";

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

const DEV_PASSWORD = "shunkhlai-dev";

const isProduction = process.env.NODE_ENV === "production";

/**
 * `=== "development"`, not `!== "production"`.
 *
 * The difference is every environment that names itself something else, or
 * nothing at all: a `next start` behind a service manager that never set
 * NODE_ENV used to land here and quietly accept the constant below. That was
 * survivable when this was one password guarding one desk. It is not now —
 * with `app_user` empty, this constant opens the whole account system — so the
 * dev convenience is granted only where it was meant: `next dev`.
 */
const isDevelopment = process.env.NODE_ENV === "development";

const configuredPassword = process.env.ADMIN_PASSWORD?.trim() || null;

const password: string | null =
  configuredPassword ?? (isDevelopment ? DEV_PASSWORD : null);

if (!configuredPassword && isDevelopment) {
  console.warn(
    "[admin] ADMIN_PASSWORD is not set — /admin accepts the development " +
      `password "${DEV_PASSWORD}". See docs/newsroom.md.`,
  );
}

const secret: Buffer = (() => {
  const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicit) return Buffer.from(explicit, "utf8");
  if (password) {
    return createHmac("sha256", password)
      .update("shunkhlai.news.admin.v1")
      .digest();
  }
  return randomBytes(32);
})();

export function adminLoginAvailable(): boolean {
  return password !== null;
}

export function verifyAdminPassword(input: string): boolean {
  if (password === null) return false;
  const digest = (value: string) =>
    createHmac("sha256", secret).update(value).digest();
  return timingSafeEqual(digest(input ?? ""), digest(password));
}

function sign(expiry: number): string {
  return createHmac("sha256", secret)
    .update(`v1.${expiry}`)
    .digest("base64url");
}

export function signAdminSession(nowMs: number = Date.now()): string {
  const expiry = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  return `${expiry}.${sign(expiry)}`;
}

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
  if (
    !timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expected, "utf8"),
    )
  ) {
    return false;
  }

  return Number(rawExpiry) * 1000 > nowMs;
}

/**
 * Could this cookie value be a session of either kind?
 *
 * A shape check for `src/proxy.ts`, which runs ahead of the app and has no
 * database: it can still turn an anonymous navigation around, but it cannot
 * decide whether a token names a live row. The real check is `requireAdmin()`,
 * so a value that only looks right buys an attacker nothing but a redirect to
 * a page that refuses them.
 */
export function adminCookiePlausible(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return looksLikeSessionToken(value) || verifyAdminSession(value);
}

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
