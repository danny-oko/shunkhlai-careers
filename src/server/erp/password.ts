import "server-only";
import { eq } from "drizzle-orm";

import { getDb, applicantLink, type ApplicantLink } from "@/lib/db";
import { encryptSecret } from "@/lib/db/crypto";
import { ErpError, erpLogin, erpPost, type ErpSession } from "./client";
import {
  ErpCredentialsUnreadableError,
  decryptLinkSecret,
  getLink,
  getValidErpToken,
} from "./link";

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
  const regno = await decryptLinkSecret(clerkUserId, row.regnoEnc);
  const session = await erpLogin(regno, newpassword);
  await patchLink(clerkUserId, await sessionColumns(session, row));
}

// Only the ERP's own Mongolian retmsg is safe to persist: a D1/driver error can
// embed the SQL and its bound params (the encrypted secret, the Clerk user id).
// Unreadable stored creds keep the machine-readable marker the connect flow looks for.
const messageOf = (e: unknown) =>
  e instanceof ErpError
    ? e.message
    : e instanceof ErpCredentialsUnreadableError
      ? "credentials_unreadable"
      : RELINK_MESSAGE;

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

  return storeAfterChange(clerkUserId, newpassword);
}

/**
 * The ERP already holds the new password, so nothing below may surface as a
 * plain failure: if D1 cannot be written the stored credential is stale, and the
 * only honest answer is "re-link" (the /account connect form overwrites the row). The
 * `failed` flag is best effort, since D1 may be the thing that is down.
 */
async function storeAfterChange(
  clerkUserId: string,
  newpassword: string,
): Promise<PasswordChangeResult> {
  try {
    await updateStoredSecret(clerkUserId, newpassword);
  } catch (e) {
    await patchLink(clerkUserId, { status: "failed", lastError: messageOf(e) }).catch(() => null);
    return { relinkRequired: true };
  }
  return refreshAfterStore(clerkUserId, newpassword);
}

async function refreshAfterStore(
  clerkUserId: string,
  newpassword: string,
): Promise<PasswordChangeResult> {
  try {
    const row = await getLink(clerkUserId);
    if (!row) return { relinkRequired: true };
    await refreshTokens(clerkUserId, row, newpassword);
    return { relinkRequired: false };
  } catch (e) {
    await patchLink(clerkUserId, { status: "failed", lastError: messageOf(e) }).catch(() => null);
    return { relinkRequired: true };
  }
}
