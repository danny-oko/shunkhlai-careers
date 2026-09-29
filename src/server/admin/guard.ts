import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, verifyAdminSession } from "./session";
import { type AdminIdentity, loadSession, staffExists } from "./store";
import { looksLikeSessionToken } from "./tokens";

/**
 * The gate, for pages and for actions.
 *
 * `requireAdmin()` keeps the signature it always had — `Promise<void>`, redirect
 * on failure — so the layout and the four news actions that call it did not have
 * to change. What is new is that it now knows *who*: `currentAdmin()` returns the
 * signed-in user and their role, and `requireAdminUser()` is `requireAdmin()` for
 * callers that need that identity rather than only the permission.
 *
 * Two cookie shapes reach here, and they are told apart by shape alone:
 *
 * - 43 base64url characters — an `admin_session` token, looked up in the
 *   database (see `./store`);
 * - `<expiry>.<signature>` — the old HMAC stamp from `ADMIN_PASSWORD`, which is
 *   honoured **only while `app_user` is empty**. The instant a staff account
 *   exists, a stamp still in someone's browser stops working.
 *
 * Anything else — junk, a truncated token, a forged stamp — is simply not a
 * session. So is a lookup that throws: a database that cannot be reached must
 * shut the desk, not open it, so the catch below returns null rather than
 * propagating.
 */

/** The stand-in identity for the `ADMIN_PASSWORD` fallback, which has no row. */
export const ADMIN_PASSWORD_IDENTITY: AdminIdentity = {
  id: "admin-password",
  name: "Админ",
  email: "",
  role: "admin",
  source: "admin-password",
};

export async function currentAdmin(): Promise<AdminIdentity | null> {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  if (!value) return null;

  try {
    if (looksLikeSessionToken(value)) {
      const session = await loadSession(value);
      return session?.user ?? null;
    }

    if (!verifyAdminSession(value)) return null;
    // The fallback closes behind the first staff account, for a cookie already
    // issued as much as for a new sign-in.
    return (await staffExists()) ? null : ADMIN_PASSWORD_IDENTITY;
  } catch (error) {
    // Fail closed: no identity is a redirect to the login page, which is the
    // safe answer to "we cannot tell".
    console.error("[admin] could not read the session", error);
    return null;
  }
}

export async function isAdminRequest(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}

/** Unchanged signature: every existing caller is a bare `await requireAdmin()`. */
export async function requireAdmin(): Promise<void> {
  await requireAdminUser();
}

/**
 * May this user delete an article?
 *
 * The two roles differ on exactly this. An `editor` writes and rewrites — both
 * recoverable, because a bad edit can be edited again. Deleting is the one
 * control on the desk that destroys something, so it belongs to `admin`.
 *
 * Stated as a function rather than an `=== "admin"` scattered through the
 * actions, so that when a third role appears there is one place to teach.
 * The `ADMIN_PASSWORD` fallback identity is an admin: it is the deployment's
 * only way in, and it exists precisely so somebody can still do everything.
 */
export function mayDeleteArticles(user: AdminIdentity): boolean {
  return user.role === "admin";
}

/**
 * May this user push an application back at the ERP?
 *
 * Same shape as `mayDeleteArticles`, same reasoning. Reading the applications
 * desk is open to both roles — an `editor` who can see that a push is stuck is
 * an `editor` who can tell somebody. Pressing «Дахин илгээх» is not reading:
 * it sends an applicant's record to Shunkhlai's ERP under their own ERP
 * identity, and it is the only control on that screen with an effect outside
 * this site. So it belongs to `admin`, and the action checks this itself
 * rather than trusting the button not to be drawn.
 */
export function mayRetryApplications(user: AdminIdentity): boolean {
  return user.role === "admin";
}

/**
 * May this user read an applicant's own details — their анкет and their CV?
 *
 * Reading the applications desk is open to both roles: an `editor` who sees
 * that a push is stuck is an `editor` who can tell somebody, and the list
 * carries a name, a posting, a date and a push state, which is all that takes.
 *
 * The person behind the row is a different question. Opening it shows the
 * регистрийн дугаар, the утас — which is also the applicant's ERP password
 * (`src/lib/api/README.md`) — every family member they listed, and the CV
 * itself. That is the applicant's own data, handed to somebody who is not
 * them, and it leaves this site the moment it is downloaded. So it belongs to
 * the role that already owns the controls with consequences outside the desk,
 * and the same way as those: checked where the data is read, not only where
 * the button is drawn. An `editor` gets the desk and a line saying why the
 * rest is not there.
 */
export function mayViewApplicantData(user: AdminIdentity): boolean {
  return user.role === "admin";
}

/** The same gate, for callers that need the name, the email or the role. */
export async function requireAdminUser(): Promise<AdminIdentity> {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  return user;
}
