import "server-only";

import { buildProfilePayload } from "@/lib/api/profile-payload";
import type { ProfileInput } from "@/lib/api/profile";
import { ErpError, erpGet, erpPost, erpUpload } from "./erp";
import {
  DELETE_PARAMS,
  SECTIONS,
  type SectionKey,
  hashOf,
  isLocalId,
  snapshotOf,
} from "./erp-model";
import { type PushIdentity, type PushResult, erpRecord, profileOverlay, pushApplication } from "./erp-push";
import type { ApplicantDoc, PendingDelete, Row } from "./handlers";

/**
 * Write-through (D1 → ERP): sends every piece of local work the document
 * holds, with one token. Never throws; reports what went through so
 * `erp-sync.ts` can clear exactly that (and nothing edited meanwhile).
 *
 * Deletes only what the applicant deleted here (`pendingDeletes`); never sends
 * SaveHrAppUser; logs carry codes, endpoints and statuses only.
 */

export type FlushInput = {
  doc: ApplicantDoc;
  token: string;
  identity: PushIdentity;
  /** Run the non-application work (profile, files, deletes, section rows). */
  local: boolean;
  /** Application rows (by D1 entryid) claimed for this run. */
  apps: number[];
  loadPicture: () => Promise<string | null>;
};

export type FlushOutcome = {
  /** Local work that went through, keyed by the stamp/snapshot pushed. */
  profileStamp?: number;
  picture?: { stamp: number; hash: string | null };
  deletesDone: PendingDelete[];
  pushed: Partial<Record<SectionKey, Set<string>>>;
  /** Sources re-read after saving into them. */
  sources: Record<string, unknown>;
  appResults: Map<number, PushResult>;
  /** Request list read after the last submit. */
  appList?: Row[];
  appliedOrderIds?: number[];
  /** First failure code, when anything failed. */
  error?: string;
};

function logFailure(code: string, error: unknown) {
  const endpoint = error instanceof ErpError ? error.endpoint : "-";
  const status = error instanceof ErpError ? (error.status ?? error.message) : "-";
  console.error("[erp-flush]", code, endpoint, status);
}

/** The ERP answered that the row is already gone: the delete is done. */
const NOT_FOUND = /олдсонгүй|олдохгүй|байхгүй|not found|does not exist/i;

const stripDataUrl = (value: string) => value.replace(/^data:[^,]*,/, "");

/**
 * Labels our handler adds for display (the ERP derives its own from the ids);
 * the browser never sent them, so neither do we.
 */
const DISPLAY_ONLY = new Set([
  "universityname",
  "professionname",
  "educationlevelname",
  "forlanguagename",
  "skillcompname",
  "levelname",
  "jobname",
  "businesstypename",
  "relativename",
  "posgroupname",
  "positionname",
]);

/** The body for a section save: our marker and labels dropped, the ERP id (or 0). */
function saveBody(row: Row): Row {
  const body = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "erp" && !DISPLAY_ONLY.has(key)),
  );
  return { ...body, entryid: isLocalId(row.entryid) ? 0 : Number(row.entryid) };
}

type Ctx = {
  input: FlushInput;
  out: FlushOutcome;
  failed: (code: string, error: unknown) => void;
};

/** `/get`: the base for a profile save, and the postings already applied to. */
async function readRecord({ input, out, failed }: Ctx): Promise<Row | null> {
  try {
    const data = await erpGet<unknown>("get", input.token);
    const orders = (data as { recruitmentorders?: unknown } | null)?.recruitmentorders;
    if (Array.isArray(orders)) {
      out.appliedOrderIds = orders.map((o) => Number((o as Row).recruitmentorderid)).filter((id) => id > 0);
    }
    return erpRecord(data) as Row;
  } catch (error) {
    failed("erp_get_failed", error);
    return null;
  }
}

/** Edited here, so D1's non-empty values win over the ERP record. */
async function flushProfile({ input, out, failed }: Ctx, record: Row) {
  const stamp = input.doc.erp?.profileDirty;
  if (!stamp) return;
  try {
    const payload = buildProfilePayload(profileOverlay(input.doc.profile) as ProfileInput, record);
    await erpPost("SaveHrApplicant", input.token, payload);
    out.profileStamp = stamp;
  } catch (error) {
    failed("erp_profile_failed", error);
  }
}

async function sendPicture(input: FlushInput, stamp: number): Promise<FlushOutcome["picture"]> {
  const picture = input.doc.picture !== null ? await input.loadPicture() : null;
  // No ERP endpoint deletes a photo; a removed one has nothing to send.
  if (!picture) return { stamp, hash: null };
  await erpUpload("SaveAppPicture", input.token, { filename: "photo.jpg", base64: stripDataUrl(picture) });
  return { stamp, hash: hashOf(picture) };
}

async function flushFiles({ input, out, failed }: Ctx) {
  const erp = input.doc.erp ?? {};
  if (erp.pictureDirty) {
    try {
      out.picture = await sendPicture(input, erp.pictureDirty);
    } catch (error) {
      failed("erp_picture_failed", error);
    }
  }
}

/** Only deletes the applicant made here; "not found" means already gone. */
async function flushDeletes({ input, out, failed }: Ctx) {
  for (const item of input.doc.erp?.pendingDeletes ?? []) {
    const param = DELETE_PARAMS[item.endpoint];
    if (!param) continue;
    try {
      await erpPost(item.endpoint, input.token, undefined, `?${param}=${encodeURIComponent(item.entryid)}`);
      out.deletesDone.push(item);
    } catch (error) {
      if (error instanceof ErpError && NOT_FOUND.test(error.message)) out.deletesDone.push(item);
      else failed("erp_delete_failed", error);
    }
  }
}

/** Saves one section's pending rows; returns true when any went through. */
async function flushSection(ctx: Ctx, config: (typeof SECTIONS)[number]): Promise<boolean> {
  const pending = ctx.input.doc[config.key].filter((row) => row.erp === "pending");
  if (!config.save || pending.length === 0) return false;
  const done = (ctx.out.pushed[config.key] ??= new Set());
  const groups = config.batch ? [pending] : pending.map((row) => [row]);
  let any = false;
  for (const group of groups) {
    try {
      const body = config.batch ? group.map(saveBody) : saveBody(group[0]);
      await erpPost(config.save, ctx.input.token, body);
      for (const row of group) done.add(snapshotOf(row));
      any = true;
    } catch (error) {
      ctx.failed("erp_save_failed", error);
    }
  }
  return any;
}

async function flushSections(ctx: Ctx) {
  const touched = new Set<string>();
  for (const config of SECTIONS) {
    if (await flushSection(ctx, config)) touched.add(config.source);
  }
  // Re-read what was saved into, so local rows adopt their ERP ids.
  for (const source of touched) {
    try {
      ctx.out.sources[source] = await erpGet<unknown>(source, ctx.input.token);
    } catch (error) {
      ctx.failed("erp_repull_failed", error);
    }
  }
}

async function flushApplications({ input, out }: Ctx) {
  // The login (and any profile work) already happened above.
  const batch = {
    login: Promise.resolve({ ok: true as const, value: input.token }),
    sync: Promise.resolve({ ok: true as const, value: undefined }),
  };
  // A working copy, so each push sees the ERP ids the previous ones found.
  const working: ApplicantDoc = {
    ...input.doc,
    applications: input.doc.applications.map((row) => ({ ...row })),
  };
  for (const entryid of input.apps) {
    const app = working.applications.find((row) => Number(row.entryid) === entryid);
    if (!app) continue;
    const result = await pushApplication(working, app, {
      identity: input.identity,
      batch,
      appliedOrderIds: out.appliedOrderIds,
    });
    out.appResults.set(entryid, result);
    if (result.erpList) out.appList = result.erpList;
    if (result.erpEntryId) app.erp = { ...(app.erp as Row), erpEntryId: result.erpEntryId };
    if (result.status === "failed") out.error ??= result.error;
  }
}

export async function flush(input: FlushInput): Promise<FlushOutcome> {
  const out: FlushOutcome = { deletesDone: [], pushed: {}, sources: {}, appResults: new Map() };
  const ctx: Ctx = {
    input,
    out,
    failed: (code, error) => {
      logFailure(code, error);
      out.error ??= code;
    },
  };

  const needRecord = (input.local && !!input.doc.erp?.profileDirty) || input.apps.length > 0;
  const record = needRecord ? await readRecord(ctx) : null;

  if (input.local) {
    if (record) await flushProfile(ctx, record);
    await flushFiles(ctx);
    await flushDeletes(ctx);
    await flushSections(ctx);
  }
  if (input.apps.length > 0) await flushApplications(ctx);
  return out;
}
