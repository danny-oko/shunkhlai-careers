"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminLoginAvailable,
  signAdminSession,
  verifyAdminPassword,
} from "@/server/admin/session";

export type LoginState = { error?: string };

/**
 * The only way in.
 *
 * The failure message says "wrong password" and nothing else on purpose —
 * there is one account, so there is no username to be wrong about, and a
 * message that distinguished "no password configured" from "wrong password"
 * would tell an unauthenticated caller which of those a deployment is.
 * (The unconfigured case does get its own message, but only because a
 * deployment with the gate shut is a misconfiguration the operator has to be
 * able to see — and it is reported identically to everyone, so it reveals
 * nothing a guess would not.)
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!adminLoginAvailable()) {
    return { error: "Админ нэвтрэлт тохируулаагүй байна. ADMIN_PASSWORD-г тохируулна уу." };
  }

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Нууц үгээ оруулна уу." };

  if (!verifyAdminPassword(password)) {
    return { error: "Нууц үг буруу байна." };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, signAdminSession(), adminCookieOptions());

  // Only a path under /admin, and only one this app serves: an open redirect
  // here would let a link to our own login form land the editor anywhere.
  const next = String(formData.get("next") ?? "");
  const safeNext = /^\/admin\/[\w\-/]*$/u.test(next) ? next : "/admin/news";

  redirect(safeNext);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  // Cleared on the same path it was set on. A delete on "/" leaves the
  // /admin-scoped cookie exactly where it was and the editor stays signed in.
  store.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  redirect("/admin/login");
}
