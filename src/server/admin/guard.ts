import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, verifyAdminSession } from "./session";

export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) redirect("/admin/login");
}
