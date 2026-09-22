import "server-only";
import { createHash } from "node:crypto";

import { buildProfilePayload } from "@/lib/api/profile-payload";
import type { ApplicantProfile, ProfileInput } from "@/lib/api/profile";
import { ErpError, erpGet, erpLogin, erpPost, erpUpload, hasErp } from "./erp";
import { CLAIM_TTL_MS, MAX_ATTEMPTS, PROFILE_KEYS, RETRY_FAILED_AFTER_MS, RETRY_PENDING_AFTER_MS, erpIdOfApplication } from "./erp-model";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * Best-effort copy of an application (plus the applicant's profile and CV) to
 * the live ERP. D1 is the record of truth: the application is saved there
 * first, and this only reports how the push went so it can be stored on the
 * row and retried.
 *
 * Additive only: it updates the ERP profile (starting from the ERP's own record
 * and overlaying non-empty D1 values — SaveHrApplicant is a full replace), sends
 * the CV when it changed, and creates the application. It never deletes or
 * replaces other ERP rows and never touches education/experience/family.
 */

export type ErpPushStatus = "pending" | "sent" | "failed" | "skipped";

/** Stored on each D1 application row as `erp`. */
export type ApplicationErp = {
  status: ErpPushStatus;
  error?: string;
  attempts: number;
  /** ISO timestamp. */
  lastAttemptAt: string;
  erpEntryId?: number;
  /** A sync task is pushing this row (ISO); others leave it alone for a while. */
  claimedAt?: string;
};

export type PushResult = {
  status: "sent" | "failed" | "skipped";
  error?: string;
  erpEntryId?: number;
  /** Set when the CV was sent; persist as `doc.erp.cvHash`. */
  cvHash?: string;
  /** The ERP request list read after submitting (for the re-pull). */
  erpList?: Row[];
};

export type PushIdentity = { firstname: string; lastname: string; email: string };

export type PushDeps = {
  identity: PushIdentity;
  /** The stored CV (base64), loaded only when needed. */
  loadCv: () => Promise<{ filename: string; data: string } | null>;
  /** Shared by the pushes of one batch: one login, one profile/CV sync. */
  batch?: PushBatch;
  /** Postings the ERP already has an application for (`/get` recruitmentorders). */
  appliedOrderIds?: number[];
};

export type Step<T> = { ok: true; value: T } | { ok: false; error: string };

export type PushBatch = {
  login?: Promise<Step<string>>;
  sync?: Promise<Step<string | undefined>>;
};

export const createPushBatch = (): PushBatch => ({});

/* --- helpers ------------------------------------------------------------ */

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

function logFailure(code: string, error: unknown) {
  const endpoint = error instanceof ErpError ? error.endpoint : "-";
  const status = error instanceof ErpError ? (error.status ?? error.message) : "-";
  // Never the payload, credentials or token — only where and how it failed.
  console.error("[erp-push]", code, endpoint, status);
}

const LICENCE_KEYS = ["isa", "isb", "isc", "isd", "ise"] as const;

/**
 * The D1 profile values worth sending: non-empty ones only, so nothing the
 * ERP holds is blanked. Licence flags only ever go from false to true.
 */
/**
 * D1 profile values to write over the ERP record. Until the applicant has saved
 * their profile on our site, D1 only holds Clerk defaults (name, email), so
 * those may fill ERP blanks but never replace what the ERP already has.
 */
export function profileOverlay(profile: Row, erpRecord?: Row): Partial<ProfileInput> {
  const overlay: Record<string, unknown> = {};
  for (const key of PROFILE_KEYS) {
    const value = profile[key];
    if (str(value) === "") continue;
    if (erpRecord && str(erpRecord[key]) !== "") continue;
    overlay[key] = value;
  }
  for (const key of LICENCE_KEYS) {
    if (profile[key] === true) overlay[key] = true;
  }
  return overlay as Partial<ProfileInput>;
}

/** `/get` answers `{ applicantdata: [record], … }`; the mock answers flat. */
export function erpRecord(data: unknown): ApplicantProfile {
  if (data && typeof data === "object") {
    const list = (data as { applicantdata?: unknown }).applicantdata;
    if (Array.isArray(list)) return (list[0] ?? {}) as ApplicantProfile;
    return data as ApplicantProfile;
  }
  return {};
}

const DUPLICATE = /аль хэдийн|давхард|давхцаж|already|duplicate/i;

/** The ERP refused a repeat application — the first one is there, so: sent. */
export const isDuplicateApplication = (error: unknown) =>
  error instanceof ErpError && DUPLICATE.test(error.message);


/**
 * The ERP's request row for this posting, matched on `recruitmentorderid` only.
 * No name-based fallback: a wrong id would make a later cancel withdraw a
 * different application. Unknown id → the ERP copy is just not auto-cancelled.
 */
export function findErpEntryId(rows: Row[], app: Row): number | undefined {
  const orderId = Number(app.recruitmentorderid);
  const candidates = rows.filter((row) => Number(row.recruitmentorderid) === orderId);
  const ids = candidates.map((row) => Number(row.entryid)).filter((id) => id > 0);
  return ids.length ? Math.max(...ids) : undefined;
}

/** The body the browser sends to SaveHrRecruitmentOrderApp (`jobs/apply.ts`). */
function applicationPayload(app: Row): Record<string, unknown> {
  return {
    recruitmentorderid: Number(app.recruitmentorderid),
    sourcetype: str(app.sourcetype) || "WEB",
    ...(app.salrequest === null || app.salrequest === undefined ? {} : { salrequest: app.salrequest }),
    poshiredate: str(app.availabledate),
    recsourceid: app.recsourceid,
  };
}

function entryIdFrom(retdata: unknown): number | undefined {
  const value =
    typeof retdata === "number"
      ? retdata
      : retdata && typeof retdata === "object"
        ? Number((retdata as Row).entryid)
        : NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/* --- steps -------------------------------------------------------------- */

/** One ERP login with the applicant's регистр + phone. Never throws. */
export async function loginFor(doc: ApplicantDoc): Promise<Step<string>> {
  const regno = str(doc.profile.regno);
  const phone = str(doc.profile.mobilephone);
  // No auto-register: the ERP answers "not registered" and "wrong phone" with
  // the same 401, and SaveHrAppUser is a create-or-update keyed by регистр
  // that returns a token — registering on a failed login could overwrite (or
  // hand over) another applicant's ERP record. The row stays in D1 as failed.
  try {
    return { ok: true, value: await erpLogin(regno, phone) };
  } catch (error) {
    logFailure("erp_login_failed", error);
    return { ok: false, error: "erp_login_failed" };
  }
}

/** Profile, then CV if it changed. Resolves to the CV hash when one was sent. */
async function syncProfileAndCv(
  doc: ApplicantDoc,
  token: string,
  deps: PushDeps,
): Promise<Step<string | undefined>> {
  try {
    const record = erpRecord(await erpGet<unknown>("get", token));
    const input = {
      ...profileOverlay(doc.profile, doc.erp?.profileEdited ? undefined : (record as Row)),
    } as ProfileInput;
    await erpPost("SaveHrApplicant", token, buildProfilePayload(input, record));
  } catch (error) {
    logFailure("erp_profile_failed", error);
    return { ok: false, error: "erp_profile_failed" };
  }

  if (!doc.cv) return { ok: true, value: undefined };
  try {
    const cv = await deps.loadCv();
    if (!cv?.data) return { ok: true, value: undefined };
    const hash = createHash("sha256").update(cv.data).digest("hex");
    if (hash === doc.erp?.cvHash) return { ok: true, value: undefined };
    await erpUpload("SaveAppCV", token, { filename: cv.filename, base64: cv.data });
    return { ok: true, value: hash };
  } catch (error) {
    logFailure("erp_cv_failed", error);
    return { ok: false, error: "erp_cv_failed" };
  }
}

/* --- entry points ------------------------------------------------------- */

/** Pushes one D1 application row to the ERP. Never throws. */
export async function pushApplication(
  doc: ApplicantDoc,
  app: Row,
  deps: PushDeps,
): Promise<PushResult> {
  if (!hasErp()) return { status: "skipped" };
  if (!str(doc.profile.regno) || !str(doc.profile.mobilephone)) {
    return { status: "failed", error: "profile_incomplete" };
  }

  const batch = deps.batch ?? createPushBatch();
  batch.login ??= loginFor(doc);
  const session = await batch.login;
  if (!session.ok) return { status: "failed", error: session.error };
  const token = session.value;

  batch.sync ??= syncProfileAndCv(doc, token, deps);
  const synced = await batch.sync;
  if (!synced.ok) return { status: "failed", error: synced.error };
  const cvHash = synced.value;

  // Already applied (per the ERP's own record): never submit it twice.
  if ((deps.appliedOrderIds ?? []).includes(Number(app.recruitmentorderid))) {
    return { status: "sent", cvHash };
  }

  // The request list carries no recruitmentorderid, so the new application is
  // the one id that was not there before. "Before" = the ERP ids this document
  // already knows (from the last pull), which saves a call per push.
  const known = new Set(
    doc.applications.map(erpIdOfApplication).filter((id): id is number => id !== undefined),
  );

  let erpEntryId: number | undefined;
  try {
    erpEntryId = entryIdFrom(
      await erpPost<unknown>("SaveHrRecruitmentOrderApp", token, applicationPayload(app)),
    );
  } catch (error) {
    if (!isDuplicateApplication(error)) {
      logFailure("erp_apply_failed", error);
      return { status: "failed", error: "erp_apply_failed", cvHash };
    }
  }

  let erpList: Row[] | undefined;
  try {
    const rows = await erpGet<Row[] | null>("getRecruitmenRequestList", token);
    erpList = Array.isArray(rows) ? rows : [];
    if (erpEntryId === undefined) {
      const added = erpList
        .map((row) => Number(row.entryid))
        .filter((id) => id > 0 && !known.has(id));
      // Exactly one new id is unambiguous; otherwise fall back to an exact
      // recruitmentorderid match (when the list carries it), else leave unset.
      erpEntryId = added.length === 1 ? added[0] : findErpEntryId(erpList, app);
    }
  } catch (error) {
    // Sent all the same; only the id for a later withdrawal is missing.
    logFailure("erp_list_failed", error);
  }

  return { status: "sent", erpEntryId, cvHash, erpList };
}

/** Withdraws the ERP copy of an application. Best-effort; never throws. */
export async function withdrawFromErp(
  doc: ApplicantDoc,
  erpEntryId: number,
  // Accepted for call-site symmetry with `pushApplication`; login needs only the profile.
  _identity?: PushIdentity,
): Promise<void> {
  if (!hasErp() || !str(doc.profile.regno) || !str(doc.profile.mobilephone)) return;
  try {
    const token = await erpLogin(str(doc.profile.regno), str(doc.profile.mobilephone));
    await erpPost("DeleteOrderApp", token, undefined, `?entryID=${erpEntryId}`);
  } catch (error) {
    logFailure("erp_withdraw_failed", error);
  }
}

/* --- retry policy ------------------------------------------------------- */

export { MAX_ATTEMPTS };

/** Rows due another push: pending/failed, under the cap, and old enough. */
export function isDue(app: Row, now = Date.now()): boolean {
  const erp = app.erp as ApplicationErp | undefined;
  if (!erp || (erp.status !== "pending" && erp.status !== "failed")) return false;
  if ((erp.attempts ?? 0) >= MAX_ATTEMPTS) return false;
  const claimed = Date.parse(erp.claimedAt ?? "");
  if (Number.isFinite(claimed) && now - claimed < CLAIM_TTL_MS) return false;
  const last = Date.parse(erp.lastAttemptAt ?? "");
  const wait = erp.status === "pending" ? RETRY_PENDING_AFTER_MS : RETRY_FAILED_AFTER_MS;
  return !Number.isFinite(last) || now - last >= wait;
}
