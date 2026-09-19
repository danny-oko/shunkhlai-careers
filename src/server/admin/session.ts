import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "shunkhlai.admin";

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

const DEV_PASSWORD = "shunkhlai-dev";

const isProduction = process.env.NODE_ENV === "production";

const configuredPassword = process.env.ADMIN_PASSWORD?.trim() || null;

const password: string | null =
  configuredPassword ?? (isProduction ? null : DEV_PASSWORD);

if (!configuredPassword && !isProduction) {
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
