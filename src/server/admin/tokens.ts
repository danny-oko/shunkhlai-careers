/**
 * The value in the `shunkhlai.admin` cookie, and the hash that is stored.
 *
 * The token is 32 random bytes and means nothing on its own — it is a lookup
 * key into `admin_session`, not a signed claim. That is the whole difference
 * from the HMAC cookie this replaces: a stamp that carries its own expiry can
 * only be waited out, whereas a row can be deleted, so logout and a password
 * change really do end the session.
 *
 * Only the SHA-256 of the token is written to the database. A dump of
 * `admin_session` therefore cannot be replayed as a cookie — the same reason
 * password hashes are stored rather than passwords. SHA-256 with no salt and
 * no stretching is the right primitive here and would be wrong for a password:
 * the input is 256 bits of entropy from `randomBytes`, so there is no
 * dictionary to run and nothing to slow an attacker down for.
 *
 * base64url, so the value can sit in a cookie with no escaping, and with no
 * `.` in the alphabet — which is what lets the guard tell one of these apart
 * from a legacy `<expiry>.<signature>` stamp at a glance.
 */
import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/** base64url of 32 random bytes: 43 characters of `[A-Za-z0-9_-]`. */
export function newSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** The `admin_session.token_hash` for a token. Hex, so it is easy to eyeball. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * True when a cookie value could be one of our tokens.
 *
 * A cheap shape check, not a security check — it exists so a legacy HMAC
 * stamp (which always contains a `.`) is never sent to the database as a
 * token hash lookup, and so obvious junk is rejected before a query.
 */
export function looksLikeSessionToken(value: string): boolean {
  return /^[\w-]{43}$/u.test(value);
}
