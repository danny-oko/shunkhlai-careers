import "server-only";
import { eq } from "drizzle-orm";

import {
  getDb,
  applicantLink,
  applicantProfile,
  type ApplicantLink,
} from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/db/crypto";
import { erpLogin, erpGet, type ErpSession } from "./client";

/** The ERP `/api/applicant/get` payload nests the record under `applicantdata`. */
type ErpGetResponse = { applicantdata?: Array<Record<string, unknown>> };
export type ApplicantData = Record<string, unknown>;

export type LinkInput = {
  clerkUserId: string;
  regno: string;
  phone: string;
  firstname?: string;
  lastname?: string;
  email?: string;
};

export async function linkAccount(
  input: LinkInput,
): Promise<{ appId: string | null }> {
  const session = await erpLogin(input.regno, input.phone);

  const db = getDb();
  const now = new Date();
  const secrets = await encryptSession(input.regno, input.phone, session);

  await db
    .insert(applicantLink)
    .values({
      id: crypto.randomUUID(),
      clerkUserId: input.clerkUserId,
      firstname: input.firstname ?? null,
      lastname: input.lastname ?? null,
      email: input.email ?? null,
      ...secrets,
      erpAppId: session.appId,
      erpTokenExpiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      status: "linked",
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: applicantLink.clerkUserId,
      set: {
        firstname: input.firstname ?? null,
        lastname: input.lastname ?? null,
        email: input.email ?? null,
        ...secrets,
        erpAppId: session.appId,
        erpTokenExpiresAt: session.expiresAt
          ? new Date(session.expiresAt)
          : null,
        status: "linked",
        lastError: null,
        updatedAt: now,
      },
    });

  // Mirror the applicant's personal data into our own DB.
  await syncProfile(input.clerkUserId).catch(() => null);

  return { appId: session.appId };
}

/**
 * Fetches the applicant's personal data from the ERP and stores a JSON snapshot
 * in our DB (`applicant_profile`). This is the "keep every personal detail in
 * our own database" mirror. Returns the record, or null if none.
 */
export async function syncProfile(clerkUserId: string): Promise<ApplicantData | null> {
  const token = await getValidErpToken(clerkUserId);
  const res = await erpGet<ErpGetResponse>("/api/applicant/get", token);
  const record = res?.applicantdata?.[0] ?? null;
  if (!record) return null;

  const db = getDb();
  const now = new Date();
  // Keep the profile picture (picturedata) but drop the CV blob (filedata) from
  // our mirror — it's large and needn't be persisted (see STATE.md's PII note).
  const { filedata: _cv, ...stored } = record as Record<string, unknown>;
  const dataJson = JSON.stringify(stored);
  await db
    .insert(applicantProfile)
    .values({ id: crypto.randomUUID(), clerkUserId, dataJson, syncedAt: now })
    .onConflictDoUpdate({
      target: applicantProfile.clerkUserId,
      set: { dataJson, syncedAt: now },
    });

  return record;
}

async function encryptSession(
  regno: string,
  phone: string,
  session: ErpSession,
) {
  return {
    regnoEnc: await encryptSecret(regno),
    phoneEnc: await encryptSecret(phone),
    erpAccessTokenEnc: await encryptSecret(session.accessToken),
    erpRefreshTokenEnc: session.refreshToken
      ? await encryptSecret(session.refreshToken)
      : null,
  };
}

export async function getLink(
  clerkUserId: string,
): Promise<ApplicantLink | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(applicantLink)
    .where(eq(applicantLink.clerkUserId, clerkUserId));
  return row ?? null;
}

export async function isLinked(clerkUserId: string): Promise<boolean> {
  const row = await getLink(clerkUserId);
  return row?.status === "linked";
}

/**
 * The stored credentials exist but cannot be decrypted (e.g. APP_ENCRYPTION_KEY
 * was rotated). Retrying cannot help; the user has to re-link from /account.
 */
export class ErpCredentialsUnreadableError extends Error {
  constructor(message = "Stored ERP credentials cannot be decrypted.") {
    super(message);
    this.name = "ErpCredentialsUnreadableError";
  }
}

/**
 * Flags the link as needing a re-link and drops the undecryptable session
 * columns. regno/phone are NOT NULL, so they stay until the /account connect form overwrites them.
 */
export async function markCredentialsUnreadable(clerkUserId: string): Promise<void> {
  await getDb()
    .update(applicantLink)
    .set({
      status: "failed",
      lastError: "credentials_unreadable",
      erpAccessTokenEnc: null,
      erpRefreshTokenEnc: null,
      erpTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(applicantLink.clerkUserId, clerkUserId));
}

/**
 * Decrypts a stored link secret; on failure marks the link unreadable and
 * throws `ErpCredentialsUnreadableError`.
 */
export async function decryptLinkSecret(
  clerkUserId: string,
  value: string,
): Promise<string> {
  try {
    return await decryptSecret(value);
  } catch (e) {
    // Only a wrong key / tampered ciphertext (OperationError) or corrupt base64
    // (InvalidCharacterError) means the row is unreadable. Anything else — e.g.
    // APP_ENCRYPTION_KEY missing — is a config fault and must not flag users.
    const name = (e as { name?: string } | null)?.name;
    if (name !== "OperationError" && name !== "InvalidCharacterError") throw e;
    await markCredentialsUnreadable(clerkUserId).catch((err) =>
      console.error("[erp/link] could not flag unreadable credentials", err)
    );
    throw new ErpCredentialsUnreadableError();
  }
}

/**
 * Returns a valid ERP access token for a linked user, reusing the stored one
 * until ~1 min before expiry and otherwise re-authenticating with the stored
 * (decrypted) regno + phone and persisting the fresh token. Throws if the user
 * has no link, or `ErpCredentialsUnreadableError` (after flagging the row) if
 * the stored secrets cannot be decrypted. `erpLogin` errors propagate as-is.
 */
export async function getValidErpToken(clerkUserId: string): Promise<string> {
  const row = await getLink(clerkUserId);
  if (!row) throw new Error("Applicant is not linked to the ERP yet.");

  const skewMs = 60_000;
  if (
    row.erpAccessTokenEnc &&
    row.erpTokenExpiresAt &&
    row.erpTokenExpiresAt.getTime() - skewMs > Date.now()
  ) {
    return decryptLinkSecret(clerkUserId, row.erpAccessTokenEnc);
  }

  // Refresh by re-logging in with the stored creds.
  const regno = await decryptLinkSecret(clerkUserId, row.regnoEnc);
  const phone = await decryptLinkSecret(clerkUserId, row.phoneEnc);
  const session = await erpLogin(regno, phone);

  const db = getDb();
  await db
    .update(applicantLink)
    .set({
      erpAccessTokenEnc: await encryptSecret(session.accessToken),
      erpRefreshTokenEnc: session.refreshToken
        ? await encryptSecret(session.refreshToken)
        : row.erpRefreshTokenEnc,
      erpAppId: session.appId ?? row.erpAppId,
      erpTokenExpiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      status: "linked",
      updatedAt: new Date(),
    })
    .where(eq(applicantLink.clerkUserId, clerkUserId));

  return session.accessToken;
}
