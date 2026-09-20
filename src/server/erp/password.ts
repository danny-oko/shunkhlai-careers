import "server-only";
import { eq } from "drizzle-orm";

import { getDb, applicantLink, type ApplicantLink } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/db/crypto";
import { erpLogin, erpPost, type ErpSession } from "./client";
import { getLink, getValidErpToken } from "./link";

export type PasswordChangeResult = { relinkRequired: boolean };

const RELINK_MESSAGE = "Дахин нэвтрэх амжилтгүй боллоо.";

async function patchLink(clerkUserId: string, values: Partial<ApplicantLink>) {
  await getDb()
    .update(applicantLink)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(applicantLink.clerkUserId, clerkUserId));
}

/**
 * Re-encrypts the stored ERP password (`phoneEnc` — the phone doubles as the
 * password) through the same crypto/db path as linking.
 */
export async function updateStoredSecret(
  clerkUserId: string,
  plaintext: string,
  extra: Partial<ApplicantLink> = {},
): Promise<void> {
  await patchLink(clerkUserId, { ...extra, phoneEnc: await encryptSecret(plaintext) });
}

const encryptOr = async (value: string | null, fallback: string | null) =>
  value ? encryptSecret(value) : fallback;

async function sessionColumns(session: ErpSession, row: ApplicantLink) {
  return {
    erpAccessTokenEnc: await encryptSecret(session.accessToken),
    erpRefreshTokenEnc: await encryptOr(session.refreshToken, row.erpRefreshTokenEnc),
    erpAppId: session.appId ?? row.erpAppId,
    erpTokenExpiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
    status: "linked",
    lastError: null,
  };
}

async function refreshTokens(
  clerkUserId: string,
  row: ApplicantLink,
  newpassword: string,
): Promise<void> {
  const regno = await decryptSecret(row.regnoEnc);
  const session = await erpLogin(regno, newpassword);
  await patchLink(clerkUserId, await sessionColumns(session, row));
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : RELINK_MESSAGE);

/**
 * Changes the ERP password (`changeUserInfo` type PASSWORD) and keeps the stored
 * credential in step. `phoneEnc` is only replaced after the ERP accepted the
 * change; on an ERP error (`ErpError`, carrying the Mongolian retmsg) nothing in
 * D1 is touched.
 *
 * After success the stored tokens are refreshed by re-logging in with the new
 * password. If that fails the new password stays stored (the old one no longer
 * works, so it is the only working credential) and the row is flagged `failed`
 * with `lastError`, so the UI can ask the user to re-link.
 *
 * UNVERIFIED against the real backend: that `/auth/login`'s `mobile` accepts
 * the new password after a change, and the server's password rules.
 */
export async function changeErpPassword(
  clerkUserId: string,
  oldpassword: string,
  newpassword: string,
): Promise<PasswordChangeResult> {
  const token = await getValidErpToken(clerkUserId);
  await erpPost("/api/applicant/changeUserInfo", token, {
    type: "PASSWORD",
    oldpassword,
    newpassword,
  }); // throws ErpError on rettype != 0

  await updateStoredSecret(clerkUserId, newpassword);

  const row = await getLink(clerkUserId);
  if (!row) return { relinkRequired: true };
  try {
    await refreshTokens(clerkUserId, row, newpassword);
    return { relinkRequired: false };
  } catch (e) {
    await patchLink(clerkUserId, { status: "failed", lastError: messageOf(e) });
    return { relinkRequired: true };
  }
}
