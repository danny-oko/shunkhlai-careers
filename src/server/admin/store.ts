/**
 * Staff accounts and their sessions, in PostgreSQL.
 *
 * Two tables: `app_user` (the row a person signs in as) and `admin_session`
 * (one row per live cookie). Everything above this file — the sign-in action,
 * the guard — goes through these functions, so the SQL is in one place and
 * none of the callers touch Drizzle.
 *
 * Two rules this file keeps, and the reason each is here:
 *
 * - **The token never lands in a column.** `startSession` returns it once, to
 *   be put in the cookie; the row holds `sha256(token)` (see `./tokens`).
 * - **A session is only as good as its user.** `loadSession` joins `app_user`
 *   and refuses — and deletes the row — when the account has been deactivated
 *   since the cookie was issued. Ticking `is_active = false` therefore signs
 *   someone out rather than only stopping their next sign-in.
 */
import { randomBytes } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { adminSession, appUser, getDb, type AppUserRow } from "@/lib/db";

import { SESSION_TTL_SECONDS } from "./session";
import { hashSessionToken, newSessionToken } from "./tokens";

/** Who is signed in. `source` says which of the two doors they came through. */
export type AdminIdentity = {
  id: string;
  name: string;
  email: string;
  role: string;
  /** `app_user` is a real account; `admin-password` is the empty-table fallback. */
  source: "app_user" | "admin-password";
};

export type StartedSession = { token: string; expiresAt: Date };

/**
 * True when at least one staff account exists.
 *
 * `limit(1)` rather than `count(*)`: the question is "is the table empty", it
 * is asked on the sign-in path, and the answer stops at the first row.
 */
export async function staffExists(): Promise<boolean> {
  const rows = await getDb().select({ id: appUser.id }).from(appUser).limit(1);
  return rows.length > 0;
}

/** The account for an address, or null. The caller lowercases the email. */
export async function findStaffByEmail(email: string): Promise<AppUserRow | null> {
  const rows = await getDb().select().from(appUser).where(eq(appUser.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findStaffById(id: string): Promise<AppUserRow | null> {
  const rows = await getDb().select().from(appUser).where(eq(appUser.id, id)).limit(1);
  return rows[0] ?? null;
}

/** The identity the rest of the app sees — never the hash, never the row. */
export function identityOf(user: AppUserRow): AdminIdentity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    source: "app_user",
  };
}

/**
 * Opens a session and hands back the token, once.
 *
 * This is the only moment the token exists outside the cookie; it is returned,
 * not logged, and the row keeps only its hash.
 */
export async function startSession(
  userId: string,
  now: Date = new Date(),
): Promise<StartedSession> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await getDb().insert(adminSession).values({
    id: `ses_${randomBytes(8).toString("hex")}`,
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: now,
  });

  return { token, expiresAt };
}

/**
 * The user behind a cookie token, or null for anything that is not a live
 * session: an unknown token, a forged one, an expired one, or one belonging to
 * an account that has since been deactivated.
 *
 * The expired and deactivated cases delete the row on the way out. It is not
 * required for correctness — the check above it is — but it keeps the table
 * from accumulating dead sessions on the one path that is guaranteed to notice
 * them.
 */
export async function loadSession(
  token: string,
  now: Date = new Date(),
): Promise<{ user: AdminIdentity; expiresAt: Date } | null> {
  const tokenHash = hashSessionToken(token);

  const rows = await getDb()
    .select({ session: adminSession, user: appUser })
    .from(adminSession)
    .innerJoin(appUser, eq(adminSession.userId, appUser.id))
    .where(eq(adminSession.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.session.expiresAt.getTime() <= now.getTime() || !row.user.isActive) {
    await getDb().delete(adminSession).where(eq(adminSession.tokenHash, tokenHash));
    return null;
  }

  return { user: identityOf(row.user), expiresAt: row.session.expiresAt };
}

/** Logout: the row goes, so the cookie is dead even if someone kept a copy. */
export async function endSession(token: string): Promise<void> {
  await getDb().delete(adminSession).where(eq(adminSession.tokenHash, hashSessionToken(token)));
}

/**
 * Every session this user has, gone. Used after a password change: the point
 * of changing a password is that whoever knew the old one is locked out, and
 * a cookie they already hold would make that untrue.
 */
export async function endAllSessions(userId: string): Promise<void> {
  await getDb().delete(adminSession).where(eq(adminSession.userId, userId));
}

/** Housekeeping, called on the sign-in path: rows nobody will ever look up. */
export async function purgeExpiredSessions(now: Date = new Date()): Promise<void> {
  await getDb().delete(adminSession).where(lt(adminSession.expiresAt, now));
}

/**
 * A password change, as one transaction: every existing session dropped, the
 * new argon2id hash written, and one fresh session opened for the browser
 * doing the changing.
 *
 * The transaction is the point. As three separate statements, a crash after
 * the write and before the delete would leave the *old* sessions valid against
 * the *new* password — the precise thing a password change exists to prevent.
 * Either all three land or none do.
 *
 * The statements are also ordered so that the safe half happens first, which
 * costs nothing and matters if this ever runs somewhere transactions are not
 * honoured: sessions die before the password moves, so the worst reachable
 * state is "signed out, password unchanged" rather than the reverse.
 *
 * The caller has already verified the current password. `is_active` is checked
 * again in here, under the same transaction, because between that check and
 * this write the account could have been switched off.
 */
export async function changePassword(
  userId: string,
  passwordHash: string,
  now: Date = new Date(),
): Promise<StartedSession> {
  return getDb().transaction(async (tx) => {
    const [user] = await tx
      .select({ isActive: appUser.isActive })
      .from(appUser)
      .where(eq(appUser.id, userId))
      .limit(1);

    // A throw rolls the whole thing back, which is the intended outcome: an
    // account switched off mid-change does not get a new password or a session.
    if (!user?.isActive) throw new Error("the account is not active");

    await tx.delete(adminSession).where(eq(adminSession.userId, userId));
    await tx.update(appUser).set({ passwordHash }).where(eq(appUser.id, userId));

    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    await tx.insert(adminSession).values({
      id: `ses_${randomBytes(8).toString("hex")}`,
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      createdAt: now,
    });

    return { token, expiresAt };
  });
}
