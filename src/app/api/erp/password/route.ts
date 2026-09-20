import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ErpError } from "@/server/erp/client";
import { changeErpPassword } from "@/server/erp/password";

export const runtime = "nodejs";

const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status });

const asPasswords = (body: unknown): { oldpassword: string; newpassword: string } | null => {
  const { oldpassword, newpassword } = (body ?? {}) as Record<string, unknown>;
  const valid = [oldpassword, newpassword].every((v) => typeof v === "string" && v !== "");
  return valid ? { oldpassword: oldpassword as string, newpassword: newpassword as string } : null;
};

const toFailure = (e: unknown) =>
  e instanceof ErpError
    ? fail(e.message, 400)
    : fail("Нууц үг солих боломжгүй байна. Дахин холбогдоод үзнэ үү.", 502);

/**
 * Changes the signed-in applicant's ERP password server-side, so the stored
 * credential (`applicant_link.phone_enc`, the ERP password) is updated in the
 * same step. The browser must not call changeUserInfo directly: that would leave
 * the stored password stale and break every later server-side re-login.
 * Passwords are never logged or echoed.
 */
const run = async (userId: string, passwords: { oldpassword: string; newpassword: string }) => {
  const { relinkRequired } = await changeErpPassword(
    userId,
    passwords.oldpassword,
    passwords.newpassword,
  );
  return NextResponse.json({ ok: true, relinkRequired });
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail("unauthenticated", 401);

  const passwords = asPasswords(await request.json().catch(() => null));
  if (!passwords) return fail("Нууц үгээ бүрэн оруулна уу.", 400);

  return run(userId, passwords).catch(toFailure);
}
