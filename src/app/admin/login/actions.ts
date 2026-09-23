"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { currentAdmin } from "@/server/admin/guard";
import {
  clearEmailFailures,
  recordEmailFailure,
  throttleDelayMs,
  wait,
} from "@/server/admin/rate-limit";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  signAdminSession,
} from "@/server/admin/session";
import { signIn } from "@/server/admin/sign-in";
import { changePassword, endSession, findStaffById } from "@/server/admin/store";
import { looksLikeSessionToken } from "@/server/admin/tokens";

/**
 * The three things a signed-in staff account can do to its own session: open
 * one, close it, and change the password behind it.
 *
 * The decision about *whether* someone may in is not here — it is in
 * `@/server/admin/sign-in`, which has no cookies and no request in it and can
 * therefore be tested against a real Postgres. This file is the parts only a
 * server action can do: read the form, set the cookie, redirect.
 */

export type LoginState = { error?: string };

export type PasswordState = { error?: string; ok?: boolean };

/**
 * The caller's address, or null when we do not have one we can believe.
 *
 * `X-Forwarded-For` is written by whoever is talking to us. Trusting it turns
 * the per-address brake into a decoration — rotate the header and every
 * attempt looks like a new visitor — and worse, it hands an attacker the power
 * to *refuse* anyone: put an admin's address in the header, fail a few times,
 * and that admin is locked out from their own machine. An earlier version of
 * this function read the header unconditionally and a comment here claimed the
 * damage was contained. It was not. Both attacks were demonstrated.
 *
 * So the headers are read only when the TRUST_PROXY_HEADERS variable is set
 * to true, declaring that a reverse proxy is in front of this app and is
 * rewriting them. The customer's nginx deployment sets it (see
 * docs/newsroom.md); a direct `next start`, and every test, leaves it unset
 * and gets null.
 *
 * The **last** entry of `X-Forwarded-For` is the one used, not the first.
 * nginx's `$proxy_add_x_forwarded_for` appends to whatever the client sent, so
 * the first entry is the client's own invention and the last is the only one
 * our own proxy wrote.
 *
 * Null disarms the per-address refusal and nothing else: the per-email
 * throttle does not depend on the address, so guessing is still slowed to a
 * crawl without an address to key on.
 */
async function clientIp(): Promise<string | null> {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return null;

  const store = await headers();

  const forwarded = store.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    const nearest = hops.at(-1)?.trim();
    if (nearest) return nearest;
  }

  return store.get("x-real-ip")?.trim() || null;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const outcome = await signIn({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    ip: await clientIp(),
  });

  if (!outcome.ok) return { error: outcome.message };

  const store = await cookies();
  store.set(
    ADMIN_COOKIE,
    // A real account gets the opaque token whose row was just written; the
    // empty-table fallback has no row to point at, so it keeps the old
    // self-describing stamp.
    outcome.kind === "session" ? outcome.token : signAdminSession(),
    adminCookieOptions(),
  );

  // Only a path under /admin, and only one this app serves: an open redirect
  // here would let a link to our own login form land the editor anywhere.
  const next = String(formData.get("next") ?? "");
  const safeNext = /^\/admin\/[\w\-/]*$/u.test(next) ? next : "/admin/news";

  redirect(safeNext);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;

  // The row is what makes the cookie work, so it goes first. Clearing the
  // cookie alone would leave a token that still authenticates if anyone kept
  // a copy of it.
  if (value && looksLikeSessionToken(value)) {
    try {
      await endSession(value);
    } catch (error) {
      // The cookie is cleared below regardless: a database that is down must
      // not be a reason someone cannot sign out of their own browser.
      console.error("[admin] could not delete the session row on logout", error);
    }
  }

  // Cleared on the same path it was set on. A delete on "/" leaves the
  // /admin-scoped cookie exactly where it was and the editor stays signed in.
  store.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  redirect("/admin/login");
}

/**
 * Changes the signed-in user's own password.
 *
 * The current password is required even though the session already proves who
 * this is: it is what stops an unattended, still-signed-in browser from
 * becoming a permanent handover of the account.
 *
 * Every session for the user is dropped and a fresh one opened for this
 * browser. Changing a password whose point is to lock someone out, while
 * leaving the cookie they hold working, would not lock anyone out.
 */
export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const identity = await currentAdmin();
  if (!identity) return { error: "Нэвтрээгүй байна. Дахин нэвтэрнэ үү." };

  if (identity.source !== "app_user") {
    return {
      error:
        "ADMIN_PASSWORD-оор нэвтэрсэн тул нууц үг солих боломжгүй. Ажилтны бүртгэл үүсгэнэ үү.",
    };
  }

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  const user = await findStaffById(identity.id);
  if (!user || !user.isActive) return { error: "Бүртгэл идэвхгүй байна." };

  // Throttled on the same counter as the login form, and for the same reason:
  // this is a password check too. A session someone walked away from — or one
  // that was taken — could otherwise grind the real password here at one try
  // per argon2 verification, entirely outside the login page's brakes.
  const delay = throttleDelayMs(user.email);
  if (delay > 0) await wait(delay);

  if (!(await verifyPassword(user.passwordHash, current))) {
    recordEmailFailure(user.email);
    return { error: "Одоогийн нууц үг буруу байна." };
  }

  clearEmailFailures(user.email);

  if (next !== repeat) return { error: "Шинэ нууц үг хоёр талдаа таарахгүй байна." };

  const problem = passwordProblem(next);
  // `passwordProblem` speaks English, for the CLI; the editor reads Mongolian.
  if (problem) return { error: "Нууц үг дор хаяж 12 тэмдэгт байх ёстой." };

  // One transaction: old sessions gone, new hash written, a fresh session for
  // this browser. See `changePassword` for why it cannot be three statements.
  const { token } = await changePassword(user.id, await hashPassword(next));
  (await cookies()).set(ADMIN_COOKIE, token, adminCookieOptions());

  return { ok: true };
}
