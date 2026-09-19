import "server-only";
import { eq } from "drizzle-orm";

import {
  getDb,
  applicantLink,
  applicantProfile,
  type ApplicantLink,
} from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/db/crypto";
import { erpLogin, erpGet, erpPost, type ErpSession } from "./client";

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

/** Reads the mirrored personal data from our DB (null if never synced). */
export async function getProfileSnapshot(
  clerkUserId: string
): Promise<{ data: ApplicantData; syncedAt: Date } | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(applicantProfile)
    .where(eq(applicantProfile.clerkUserId, clerkUserId));
  if (!row) return null;
  try {
    return { data: JSON.parse(row.dataJson) as ApplicantData, syncedAt: row.syncedAt };
  } catch {
    return null;
  }
}

/** The subset of personal fields this app lets a user edit. */
export type ProfilePatch = {
  lastname?: string;
  firstname?: string;
  email2?: string;
  addr2?: string;
  maritalstatus?: string | null;
};

/**
 * Writes edited personal data back to the ERP (`SaveHrApplicant`) and refreshes
 * the D1 mirror. The patch is merged OVER the current record, so required and
 * unedited fields (regno, mobilephone, contacts, location) are preserved and
 * never blanked — the same safety principle as the sign-in fix.
 */
export async function saveProfile(
  clerkUserId: string,
  patch: ProfilePatch
): Promise<ApplicantData | null> {
  const current =
    (await getProfileSnapshot(clerkUserId))?.data ??
    (await syncProfile(clerkUserId)) ??
    {};

  const pick = (k: string) => (k in patch ? (patch as Record<string, unknown>)[k] : current[k]);

  const body = {
    // Required — always sent from the current record unless explicitly edited.
    regno: current.regno ?? "",
    mobilephone: current.mobilephone ?? "", // the ERP password; not edited here
    lastname: pick("lastname") ?? "",
    firstname: pick("firstname") ?? "",
    // Editable.
    email2: pick("email2") ?? "",
    addr2: pick("addr2") ?? "",
    maritalstatus: pick("maritalstatus") ?? null,
    // Preserved as-is so a partial edit never wipes them.
    countryid: current.countryid ?? null,
    divisionid: current.divisionid ?? null,
    districtid: current.districtid ?? null,
    contactname: current.contactname ?? "",
    relativeid: current.relativeid ?? null,
    contactphone: current.contactphone ?? "",
    contactname2: current.contactname2 ?? "",
    relativeid2: current.relativeid2 ?? null,
    contactphone2: current.contactphone2 ?? "",
  };

  // The backend rejects null for numeric fields (e.g. relativeid → Decimal), so
  // send only the fields that have a value. Empty strings are fine for text.
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== null && v !== undefined)
  );

  const token = await getValidErpToken(clerkUserId);
  await erpPost("/api/applicant/SaveHrApplicant", token, payload); // throws on rettype != 0

  // Re-read from the ERP so our mirror reflects exactly what was saved.
  return syncProfile(clerkUserId);
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
 * Returns a valid ERP access token for a linked user, reusing the stored one
 * until ~1 min before expiry and otherwise re-authenticating with the stored
 * (decrypted) regno + phone and persisting the fresh token. Throws if the user
 * has no link.
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
    return decryptSecret(row.erpAccessTokenEnc);
  }

  // Refresh by re-logging in with the stored creds.
  const regno = await decryptSecret(row.regnoEnc);
  const phone = await decryptSecret(row.phoneEnc);
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
