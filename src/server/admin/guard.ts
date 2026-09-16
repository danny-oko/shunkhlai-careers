import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, verifyAdminSession } from "./session";

/**
 * The gate as the app sees it.
 *
 * `src/proxy.ts` performs the same check before a route renders, but that is a
 * redirect for the reader's benefit and nothing more — a proxy is documented to
 * run outside the app and can be bypassed by anything that reaches the app
 * another way. These two functions are the actual authorisation, and every
 * admin layout and every mutating action calls one of them first.
 */

export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}

/** Call this before reading or writing anything behind `/admin`. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) redirect("/admin/login");
}
