/**
 * Password hashing for `app_user`, with argon2id.
 *
 * argon2id is the algorithm OWASP names first for new password storage: it is
 * memory-hard, so the commodity GPU that makes bcrypt-at-low-cost cheap to
 * attack does not help much. Nothing here invents any cryptography — it is a
 * thin, well-named wrapper over `@node-rs/argon2` so no caller ever reaches
 * for a raw hash function, and so the parameters live in one place.
 *
 * `@node-rs/argon2` rather than `argon2`: it ships prebuilt binaries for
 * darwin-arm64 and linux-x64-gnu, so it installs on this laptop and on the
 * customer's Ubuntu host without node-gyp, a compiler or a network fetch at
 * install time.
 *
 * The hash is a PHC string (`$argon2id$v=19$m=…,t=…,p=…$salt$hash`) and
 * carries its own salt and parameters, so `verifyPassword` keeps working for
 * hashes made before the parameters below were last raised.
 *
 * Callers: `scripts/users/create-user.ts`, the `/admin` sign-in
 * (`src/server/admin/sign-in.ts`) and the password-change action.
 */
import { hash, verify } from "@node-rs/argon2";

/**
 * OWASP's baseline for argon2id: 19 MiB of memory, two passes, one lane.
 * Raising these later is safe — old hashes verify with the parameters they
 * were made with.
 *
 * `algorithm` is left at the library's default, which is argon2id; naming it
 * would mean importing `Algorithm`, an ambient const enum this project's
 * `isolatedModules` build cannot read. The test asserts the `$argon2id$`
 * prefix, so the default cannot drift underneath us unnoticed.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Rejected outright rather than hashed: an empty password is not a password. */
export const MIN_PASSWORD_LENGTH = 12;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** The argon2id PHC string for this password. Never store the password itself. */
export async function hashPassword(password: string): Promise<string> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  return hash(password, OPTIONS);
}

/**
 * True when the password matches the stored hash.
 *
 * A malformed or truncated hash is a false, not a throw: a corrupt row must
 * fail the sign-in, not the request.
 */
export async function verifyPassword(hashString: string, password: string): Promise<boolean> {
  try {
    return await verify(hashString, password, OPTIONS);
  } catch {
    return false;
  }
}
