import "server-only";

import { buildProfilePayload } from "@/lib/api/profile-payload";
import type { ProfileInput } from "@/lib/api/profile";
import { ErpError, erpGet, erpPost, erpUpload } from "./erp";
import {
  DELETE_PARAMS,
  SECTIONS,
  type SectionConfig,
  type SectionKey,
  type Adoption,
  adoptRows,
  deletedIds,
  hashOf,
  isLocalId,
  labelSources,
  mergeSection,
  planAdoption,
  saveBody,
  sectionList,
  snapshotOf,
} from "./erp-model";
import { type PushIdentity, type PushResult, erpRecord, profileOverlay, pushApplication } from "./erp-push";
import type { ApplicantDoc, PendingDelete, Row } from "./handlers";
import { referenceDeps } from "./reference";

/**
 * Write-through (D1 → ERP): sends every piece of local work the document
 * holds, with one token. Never throws; reports what went through so
 * `erp-sync.ts` can clear exactly that (and nothing edited meanwhile).
 *
 * Deletes only what the applicant deleted here (`pendingDeletes`); gets its
 * token from `loginFor` (the only place SaveHrAppUser is ever sent, and only
 * after a 401); logs carry codes, endpoints and statuses only.
 */

export type FlushInput = {
  doc: ApplicantDoc;
  token: string;
  identity: PushIdentity;
  /** Run the non-application work (profile, files, deletes, section rows). */
  local: boolean;
  /** Application rows (by D1 entryid) claimed for this run. */
  apps: number[];
  loadCv: () => Promise<{ filename: string; data: string } | null>;
  loadPicture: () => Promise<string | null>;
};

export type FlushOutcome = {
  /** Local work that went through, keyed by the stamp/snapshot pushed. */
  profileStamp?: number;
  cv?: { stamp: number; hash: string | null };
  picture?: { stamp: number; hash: string | null };
  deletesDone: PendingDelete[];
  pushed: Partial<Record<SectionKey, Set<string>>>;
  /** The adoption pass each section's unadopted rows had (see `planAdoption`). */
  adopted: Partial<Record<SectionKey, Adoption>>;
  /**
   * Sources as the ERP last answered them in this run: re-read after saving
   * into them, or read before a save that needed it. A post-save re-read that
   * fails leaves its source out (a read from before the save would lack the
   * rows just saved).
   */
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

/**
 * Edited here, so D1's non-empty values win over the ERP record, and the
 * fields the applicant emptied go empty (an omitted field is reset too).
 */
async function flushProfile({ input, out, failed }: Ctx, record: Row) {
  const stamp = input.doc.erp?.profileDirty;
  if (!stamp) return;
  try {
    const erp = input.doc.erp;
    const payload = buildProfilePayload(
      profileOverlay(input.doc.profile, undefined, erp?.profileCleared) as ProfileInput,
      record,
    );
    await erpPost("SaveHrApplicant", input.token, payload);
    out.profileStamp = stamp;
  } catch (error) {
    failed("erp_profile_failed", error);
  }
}

async function sendCv(input: FlushInput, stamp: number): Promise<FlushOutcome["cv"]> {
  if (!input.doc.cv) {
    await erpPost("deleteAppCV", input.token);
    return { stamp, hash: null };
  }
  const cv = await input.loadCv();
  if (!cv?.data) return undefined;
  await erpUpload("SaveAppCV", input.token, { filename: cv.filename, base64: cv.data });
  return { stamp, hash: hashOf(cv.data) };
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
  if (erp.cvDirty) {
    try {
      out.cv = await sendCv(input, erp.cvDirty);
    } catch (error) {
      failed("erp_cv_failed", error);
    }
  }
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

/**
 * What an array save sends: EVERY row of the section, not only the pending
 * ones — synced rows with their ERP id, new rows with 0 — minus rows queued for
 * deletion. Postman: "бүх мөрийг нэг дор илгээнэ". Whether the ERP replaces
 * the set with the array or upserts row by row is not verifiable without a
 * live write; sending the whole set is right under both (an edit of one row
 * never drops the others), and the re-read after it settles the ids.
 */
function batchRows(input: FlushInput, config: SectionConfig, rows: Row[]): Row[] {
  const gone = deletedIds(input.doc.erp?.pendingDeletes, config.remove);
  return rows.filter((row) => isLocalId(row.entryid) || !gone.has(Number(row.entryid)));
}

/** The section's list as the ERP has it now (its source kept in `out.sources`); null on failure. */
async function readSection(ctx: Ctx, config: SectionConfig): Promise<Row[] | null> {
  try {
    const source = await erpGet<unknown>(config.source, ctx.input.token);
    const list = sectionList(config, source);
    if (!list) throw new Error(`${config.source}: no ${config.listKey ?? "list"}`);
    ctx.out.sources[config.source] = source;
    return list;
  } catch (error) {
    ctx.failed("erp_repull_failed", error);
    return null;
  }
}

/**
 * The rows to save from. Rows the ERP took in an earlier save whose re-read
 * failed (`unadopted`) still carry local ids: sent as they are they would go
 * as `entryid: 0` — a second copy in the ERP. So the list is read first and
 * they are adopted by content (`planAdoption`); the rest of the section then
 * reads as a pull would. Null = the read failed: nothing sent this run.
 */
async function workingRows(ctx: Ctx, config: SectionConfig): Promise<Row[] | null> {
  const { doc } = ctx.input;
  if (!doc.erp?.unadopted?.[config.key]?.length) return doc[config.key];
  const list = await readSection(ctx, config);
  if (!list) return null;
  const adoption = planAdoption(doc, config, list)!;
  ctx.out.adopted[config.key] = adoption;
  return mergeSection(config, adoptRows(doc[config.key], adoption), list, doc.erp?.pendingDeletes);
}

/**
 * One array save of the whole set. "Мөр олдсонгүй." means a row went with an
 * ERP id the ERP no longer has (deleted there since the last pull): the list is
 * read, what it no longer has is left out — an edit of such a row included,
 * it is gone there — and the save is tried once more.
 */
async function saveBatch(ctx: Ctx, config: SectionConfig, rows: Row[], done: Set<string>): Promise<boolean> {
  const send = (set: Row[]) => erpPost(config.save!, ctx.input.token, set.map(saveBody));
  let set = batchRows(ctx.input, config, rows);
  try {
    await send(set);
  } catch (error) {
    if (!(error instanceof ErpError && NOT_FOUND.test(error.message))) {
      ctx.failed("erp_save_failed", error);
      return false;
    }
    const list = await readSection(ctx, config);
    if (!list) return false;
    const have = new Set(list.map((row) => Number(row.entryid)));
    const merged = mergeSection(config, rows, list, ctx.input.doc.erp?.pendingDeletes);
    const vanished = merged.filter((row) => !isLocalId(row.entryid) && !have.has(Number(row.entryid)));
    for (const row of vanished) done.add(snapshotOf(row)); // gone in the ERP, so gone here
    set = batchRows(ctx.input, config, merged.filter((row) => !vanished.includes(row)));
    try {
      await send(set);
    } catch (retryError) {
      ctx.failed("erp_save_failed", retryError);
      return false;
    }
  }
  for (const row of set) done.add(snapshotOf(row));
  return true;
}

/**
 * Saves one section's pending rows (an array section: its whole set, once any
 * row is pending); returns true when any went through.
 */
async function flushSection(ctx: Ctx, config: SectionConfig): Promise<boolean> {
  if (!config.save || !ctx.input.doc[config.key].some((row) => row.erp === "pending")) return false;
  const rows = await workingRows(ctx, config);
  if (!rows) return false;
  const done = (ctx.out.pushed[config.key] ??= new Set());
  if (config.batch) return saveBatch(ctx, config, rows, done);
  let any = false;
  for (const row of rows.filter((r) => r.erp === "pending")) {
    try {
      await erpPost(config.save, ctx.input.token, saveBody(row));
      done.add(snapshotOf(row));
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
      // A read from before the save would lack what was just saved.
      delete ctx.out.sources[source];
      ctx.failed("erp_repull_failed", error);
    }
  }
  // Those rows carry ids only; the list shows names (as a pull labels them).
  if (Object.keys(ctx.out.sources).length) await labelSources(ctx.out.sources, referenceDeps().label);
}

async function flushApplications({ input, out }: Ctx) {
  // The login (and any profile/CV work) already happened above.
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
      loadCv: input.loadCv,
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
  const out: FlushOutcome = { deletesDone: [], pushed: {}, adopted: {}, sources: {}, appResults: new Map() };
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
