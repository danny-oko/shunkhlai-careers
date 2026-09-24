import "server-only";

import {
  AccountConflictError,
  type ClerkIdentity,
  type LoadedAccount,
  loadAccount,
  readCv,
  readPicture,
  saveAccount,
} from "./account-store";
import { hasErp } from "./erp";
import { type FlushOutcome, flush } from "./erp-flush";
import {
  CLAIM_TTL_MS,
  type ErpSnapshot,
  SECTIONS,
  type SectionKey,
  type SnapshotEffect,
  type Unadopted,
  applySnapshot,
  erpReady,
  flushDue,
  hasLocalWork,
  isLocalId,
  linkedRegno,
  markLinked,
  mergeApplications,
  mergeSection,
  migrateForFirstPull,
  applyAdoption,
  deletedIds,
  pullDue,
  registering,
  unadoptedOf,
  sectionList,
  settleWithdrawnPush,
  snapshotOf,
} from "./erp-model";
import { fetchSnapshot } from "./erp-pull";
import { type ApplicationErp, NOT_READY, type PushResult, type Step, isDue, loginFor } from "./erp-push";
import { MAX_ATTEMPTS, idempotencyKey, isRetryableReason, isWaitingReason } from "./erp-retry";
import type { ApplicantDoc, DocErp, Row } from "./handlers";

/**
 * Two-way ERP sync around D1. Called from `/api/me`: the first pull may run
 * inline (bounded), everything else in `after()`.
 *
 * Every D1 write loads the account fresh, changes only what this run owns, and
 * re-runs on an optimistic-lock conflict. Work is claimed first (attempt
 * counted, `claimedAt` stamped) so a parallel request does not send it twice.
 */

const SAVE_TRIES = 3;
const INLINE_PULL_BUDGET_MS = 8_000;

type Files = { cv?: boolean; picture?: boolean };

/** Load → change → save, re-run on a lock conflict. `change` false = no write. */
async function update(
  identity: ClerkIdentity,
  change: (account: LoadedAccount) => boolean | Files,
): Promise<LoadedAccount | null> {
  for (let attempt = 0; attempt < SAVE_TRIES; attempt += 1) {
    const account = await loadAccount(identity);
    const result = change(account);
    if (result === false) return null;
    try {
      await saveAccount(account, identity, account.nextEntryId, result === true ? {} : result);
      return account;
    } catch (error) {
      if (!(error instanceof AccountConflictError)) throw error;
    }
  }
  return null;
}

const allocator = (account: LoadedAccount) => () => {
  account.nextEntryId += 1;
  return account.nextEntryId;
};

const pushIdentity = (identity: ClerkIdentity) => ({
  firstname: identity.firstname,
  lastname: identity.lastname,
  email: identity.email,
});

/**
 * A freshly submitted row's `erp`: durable here, nothing sent yet, claimed as
 * attempt 1.
 *
 * `submittedAt` is stamped now and never moved again — it is what the
 * applicant is shown as "илгээсэн огноо" and what the admin list ages rows by.
 * It is deliberately not `lastAttemptAt`, which the retries overwrite: the two
 * answer different questions ("when did this become ours" vs "when did we last
 * try the ERP"), and conflating them would make a row that has been retried
 * for a day look like it arrived a minute ago.
 */
export function pendingErp(
  email: string,
  recruitmentorderid: unknown,
  now = new Date(),
): ApplicationErp {
  return {
    status: "pending",
    attempts: 1,
    lastAttemptAt: now.toISOString(),
    submittedAt: now.toISOString(),
    key: idempotencyKey(email, recruitmentorderid),
  };
}

const appErp = (row: Row) => row.erp as ApplicationErp | undefined;

const recentlyClaimed = (iso: string | undefined, now: number) => {
  const at = Date.parse(iso ?? "");
  return Number.isFinite(at) && now - at < CLAIM_TTL_MS;
};

/** Anything due for the ERP on this document (flush or application push). */
export const syncDue = (doc: ApplicantDoc, now = Date.now()) =>
  (!hasErp() || erpReady(doc)) && (flushDue(doc, now) || doc.applications.some((row) => isDue(row, now)));

/* --- ERP account link ----------------------------------------------------- */

/**
 * Claims the one SaveHrAppUser for this applicant: a stamp on the document,
 * written under the optimistic lock, so of two requests that both got a 401
 * (an `after()` sync and an inline pull) only one registers.
 */
async function claimRegistration(identity: ClerkIdentity): Promise<boolean> {
  const account = await update(identity, ({ doc }) => {
    if (registering(doc)) return false;
    (doc.erp ??= {}).registeringAt = new Date().toISOString();
    return true;
  });
  return account !== null;
}

/** The login for this document, with the registration claim wired in. */
const login = (identity: ClerkIdentity, doc: ApplicantDoc): Promise<Step<string>> =>
  loginFor(doc, { email: identity.email, claimRegister: () => claimRegistration(identity) });

/**
 * A token for this account: record the link (fixes the регистр) and the утас
 * that earned it (the ERP password now; see `loginFor`).
 */
async function recordLinked(identity: ClerkIdentity, doc: ApplicantDoc) {
  const phone = String(doc.profile.mobilephone ?? "").trim();
  if (linkedRegno(doc) && doc.erp?.loginPhone === phone) return;
  await update(identity, ({ doc: fresh }) => {
    markLinked(fresh, doc.profile.regno, phone);
    return true;
  });
}

/* --- failures ----------------------------------------------------------- */

/** Keeps the ERP's refusal of exactly these credentials; ends a registration claim. */
function noteLoginFailure(doc: ApplicantDoc, session: Extract<Step<string>, { ok: false }>) {
  const erp = (doc.erp ??= {});
  if (session.error !== "erp_register_busy") delete erp.registeringAt;
  if (session.linkError && session.linkKey) {
    erp.linkError = session.linkError;
    erp.linkKey = session.linkKey;
  }
}

/** Login failed: the pull backs off, and due work counts the attempt. */
async function recordLoginFailure(
  identity: ClerkIdentity,
  pulled: boolean,
  session: Extract<Step<string>, { ok: false }>,
) {
  const error = session.error;
  await update(identity, ({ doc }) => {
    const now = new Date();
    const erp = (doc.erp ??= {});
    noteLoginFailure(doc, session);
    if (pulled) {
      erp.pullFailures = (erp.pullFailures ?? 0) + 1;
      erp.pullFailedAt = now.toISOString();
    }
    for (const row of doc.applications) {
      if (!isDue(row, now.getTime())) continue;
      const state = appErp(row)!;
      // The attempt is spent here (the login is part of the push), then the
      // same transition function decides whether that was the last one.
      const spent = { ...state, attempts: (state.attempts ?? 0) + 1, lastAttemptAt: now.toISOString() };
      row.erp = nextAppErp(spent, { status: "failed", error });
    }
    if (flushDue(doc, now.getTime())) {
      erp.flush = { attempts: (erp.flush?.attempts ?? 0) + 1, lastAttemptAt: now.toISOString(), error };
    }
    return true;
  });
}

/* --- pull ---------------------------------------------------------------- */

function persistSnapshot(account: LoadedAccount, snapshot: ErpSnapshot): SnapshotEffect {
  migrateForFirstPull(account.doc, allocator(account));
  return applySnapshot(account.doc, snapshot, new Date());
}

/** A full pull with an existing token, stored in D1. */
export async function pullWith(identity: ClerkIdentity, token: string): Promise<void> {
  const snapshot = await fetchSnapshot(token);
  await update(identity, (account) => persistSnapshot(account, snapshot));
}

export type InlinePull = { ok: true; token: string } | { ok: false } | { pending: Promise<unknown> };

/**
 * The first pull for an account, on the request path but bounded: past the
 * budget the page is served from D1 and the pull finishes in `after()`.
 */
export async function pullInline(identity: ClerkIdentity, doc: ApplicantDoc): Promise<InlinePull> {
  const work = (async (): Promise<InlinePull> => {
    const session = await login(identity, doc);
    if (!session.ok) {
      // Not ready (identity blank, already refused, another request registering):
      // nothing was sent, so no failure is counted and no backoff starts.
      if (!NOT_READY.has(session.error)) await recordLoginFailure(identity, true, session);
      return { ok: false };
    }
    await recordLinked(identity, doc);
    await pullWith(identity, session.value);
    return { ok: true, token: session.value };
  })().catch((error) => {
    console.error("[erp-sync]", "pull_crashed", "-", String(error));
    return { ok: false } as InlinePull;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), INLINE_PULL_BUDGET_MS);
  });
  const winner = await Promise.race([work, budget]);
  clearTimeout(timer);
  return winner === "timeout" ? { pending: work } : winner;
}

/** Should this `get` pull inline (never pulled, not backing off)? */
export const wantsInlinePull = (doc: ApplicantDoc) =>
  hasErp() && erpReady(doc) && !doc.erp?.pulledAt && pullDue(doc);

/** Should this `get` pull in the background (stale, not backing off)? */
export const wantsBackgroundPull = (doc: ApplicantDoc) =>
  hasErp() && erpReady(doc) && !!doc.erp?.pulledAt && pullDue(doc);

/* --- sync task ------------------------------------------------------------ */

type Claim = {
  local: boolean;
  apps: number[];
  /** The bookkeeping as it was before this claim (to hand the work back untouched). */
  before: { flush?: DocErp["flush"]; apps: Map<number, ApplicationErp> };
};

const emptyClaim = (): Claim => ({ local: false, apps: [], before: { apps: new Map() } });

/** Claims the due work (and clears the "scheduled" stamp). */
async function claim(
  identity: ClerkIdentity,
  mode: "mutation" | "retry",
): Promise<{ account: LoadedAccount; claim: Claim } | null> {
  let claimed: Claim = emptyClaim();
  const account = await update(identity, ({ doc }) => {
    const now = new Date();
    const iso = now.toISOString();
    const erp = (doc.erp ??= {});
    const hadSchedule = !!erp.scheduledAt;
    delete erp.scheduledAt;
    claimed = emptyClaim();
    // Not ready for the ERP (identity blank, credentials already refused):
    // claim nothing, so no attempt is spent; the work waits for new credentials.
    if (hasErp() && !erpReady(doc)) return hadSchedule;

    if (hasErp() && flushDue(doc, now.getTime())) {
      claimed.before.flush = erp.flush ? { ...erp.flush } : undefined;
      erp.flush = { attempts: (erp.flush?.attempts ?? 0) + 1, lastAttemptAt: iso, claimedAt: iso };
      claimed.local = true;
    }
    for (const row of doc.applications) {
      const state = appErp(row);
      if (!state) continue;
      claimed.before.apps.set(Number(row.entryid), { ...state });
      if (isDue(row, now.getTime())) {
        row.erp = { ...state, attempts: (state.attempts ?? 0) + 1, lastAttemptAt: iso, claimedAt: iso };
        claimed.apps.push(Number(row.entryid));
      } else if (mode === "mutation" && state.status === "pending" && !recentlyClaimed(state.claimedAt, now.getTime())) {
        // Just submitted: its first attempt was counted at submit.
        row.erp = { ...state, claimedAt: iso };
        claimed.apps.push(Number(row.entryid));
      }
    }
    return hadSchedule || claimed.local || claimed.apps.length > 0;
  });
  return account ? { account, claim: claimed } : null;
}

/** Hands claimed work back with its attempts and timestamps as they were. */
function releaseClaim(doc: ApplicantDoc, claimed: Claim) {
  const erp = (doc.erp ??= {});
  if (claimed.local) {
    if (claimed.before.flush) erp.flush = claimed.before.flush;
    else delete erp.flush;
  }
  for (const entryid of claimed.apps) {
    const row = doc.applications.find((r) => Number(r.entryid) === entryid);
    const before = claimed.before.apps.get(entryid);
    if (row && before) row.erp = before;
  }
}

/**
 * Saved but not re-read: mark them synced. A new row's ERP id is not known
 * yet — it is noted as unadopted with the body it was saved with, so it is
 * never sent as new again before the next pull or flush has looked for its
 * ERP row (`planAdoption`).
 */
function markPushed(doc: ApplicantDoc, key: SectionKey, pushed: Set<string>) {
  const local: Unadopted[] = [];
  for (const row of doc[key]) {
    if (row.erp !== "pending" || !pushed.has(snapshotOf(row))) continue;
    row.erp = "synced";
    if (isLocalId(row.entryid)) local.push(unadoptedOf(row));
  }
  if (local.length === 0) return;
  const unadopted = ((doc.erp ??= {}).unadopted ??= {});
  const ids = new Set(local.map((entry) => entry.id));
  unadopted[key] = [...(unadopted[key] ?? []).filter((entry) => !ids.has(entry.id)), ...local];
}

/** Stores what a flush achieved, on a freshly loaded document. */
function applyOutcome(
  doc: ApplicantDoc,
  claimed: Claim,
  outcome: FlushOutcome | null,
  error: string | undefined,
  now: Date,
): void {
  const erp = (doc.erp ??= {});

  if (outcome) {
    if (outcome.profileStamp && erp.profileDirty === outcome.profileStamp) {
      delete erp.profileDirty;
      delete erp.profileCleared; // the ERP has them empty now
    }
    if (outcome.cv && erp.cvDirty === outcome.cv.stamp) {
      delete erp.cvDirty;
      if (outcome.cv.hash) erp.cvHash = outcome.cv.hash;
      else delete erp.cvHash;
    }
    if (outcome.picture && erp.pictureDirty === outcome.picture.stamp) {
      delete erp.pictureDirty;
      if (outcome.picture.hash) erp.pictureHash = outcome.picture.hash;
    }
    // The ERP said no to a cancel: it still holds the application, so the
    // delete is not retried and the row comes back with the ERP's message.
    for (const refusal of outcome.deletesRefused) {
      (erp.withdrawRefused ??= {})[String(refusal.entryid)] = refusal.message;
    }
    const settled = [...outcome.deletesDone, ...outcome.deletesRefused];
    if (settled.length && erp.pendingDeletes) {
      const done = new Set(settled.map((d) => `${d.endpoint}:${d.entryid}`));
      erp.pendingDeletes = erp.pendingDeletes.filter((d) => !done.has(`${d.endpoint}:${d.entryid}`));
      if (erp.pendingDeletes.length === 0) delete erp.pendingDeletes;
    }
    if (outcome.appliedOrderIds) erp.appliedOrderIds = outcome.appliedOrderIds;

    // Sections: rows the ERP now has are represented by the re-read list.
    for (const config of SECTIONS) {
      const adoption = outcome.adopted[config.key];
      if (adoption) applyAdoption(doc, config.key, adoption);
      const pushed = outcome.pushed[config.key];
      const reread = config.source in outcome.sources ? sectionList(config, outcome.sources[config.source]) : null;
      if (reread) {
        doc[config.key] = mergeSection(config, doc[config.key], reread, erp.pendingDeletes, pushed);
      } else if (pushed?.size) {
        markPushed(doc, config.key, pushed);
      }
    }

    // Applications: per-row results, then fold into the re-read list. A row
    // withdrawn while its push ran: its ERP copy is cancelled, not re-imported.
    for (const [entryid, result] of outcome.appResults) {
      const row = doc.applications.find((r) => Number(r.entryid) === entryid);
      if (row) row.erp = nextAppErp(appErp(row), result);
      else settleWithdrawnPush(doc, entryid, result);
    }
    if (outcome.appList) {
      doc.applications = mergeApplications(doc.applications, outcome.appList, erp.pendingDeletes, now);
    }
  } else {
    // Nothing ran (login failed / mock mode): settle the claimed rows.
    for (const entryid of claimed.apps) {
      const row = doc.applications.find((r) => Number(r.entryid) === entryid);
      if (row) row.erp = nextAppErp(appErp(row), hasErp() ? { status: "failed", error } : { status: "skipped" });
    }
  }

  if (claimed.local && erp.flush) {
    const clean = !hasLocalWork(doc);
    erp.flush = clean ? undefined : { attempts: erp.flush.attempts, lastAttemptAt: erp.flush.lastAttemptAt, error: outcome?.error ?? error };
    if (!erp.flush) delete erp.flush;
  }
}

/** ERP ids of the applications queued for DeleteOrderApp. */
const queuedCancels = (doc: ApplicantDoc) => deletedIds(doc.erp?.pendingDeletes, "DeleteOrderApp");

/**
 * The one transition function for an application row: previous state + push
 * result → next state. Every path that settles a row goes through it, so the
 * rules below hold everywhere rather than in whichever branch remembered them.
 *
 * A row becomes `terminal` — stops being retried, starts being visible on the
 * admin desk — when either is true:
 *
 * - the ERP refused the payload (`retryable: false`, or a reason already known
 *   to be terminal). Retrying a rejected application forever buries it.
 * - the attempts ran out. `MAX_ATTEMPTS` is counted, not guessed: `attempts`
 *   is incremented when work is *claimed*, so a run that crashed between the
 *   claim and the result still spent its attempt.
 *
 * "Waiting" reasons (`profile_incomplete`, `erp_withdraw_pending`, …) are
 * never terminal and never spend an attempt: nothing was sent, and the row
 * goes by itself once the applicant or the other work clears.
 *
 * The claim (`claimedAt`) is always dropped: this run is finished with the row
 * either way, and leaving the lease behind would idle it for CLAIM_TTL_MS.
 */
function nextAppErp(previous: ApplicationErp | undefined, result: PushResult): ApplicationErp {
  const attempts = previous?.attempts ?? 1;
  const erp: ApplicationErp = {
    status: result.status,
    attempts,
    lastAttemptAt: previous?.lastAttemptAt ?? new Date().toISOString(),
  };
  if (previous?.key) erp.key = previous.key;
  if (previous?.submittedAt) erp.submittedAt = previous.submittedAt;
  if (result.error) erp.error = result.error;
  const erpEntryId = result.erpEntryId ?? previous?.erpEntryId;
  if (erpEntryId) erp.erpEntryId = erpEntryId;

  if (result.status === "failed" && !isWaitingReason(result.error)) {
    const refused = result.retryable === false || !isRetryableReason(result.error);
    if (refused || attempts >= MAX_ATTEMPTS) erp.terminal = true;
  }
  return erp;
}

/**
 * One background sync: claim due work, log in once, flush it, optionally pull,
 * and store the results. Never throws.
 */
export async function syncTask(
  identity: ClerkIdentity,
  options: { mode: "mutation" | "retry"; pull?: boolean; token?: string; followUp?: boolean },
): Promise<void> {
  try {
    const claimed = await claim(identity, options.mode);
    const work = claimed?.claim ?? emptyClaim();
    const pull = !!options.pull && hasErp();
    if (!work.local && work.apps.length === 0 && !pull) return;

    if (!hasErp()) {
      await update(identity, ({ doc }) => {
        applyOutcome(doc, work, null, undefined, new Date());
        return true;
      });
      return;
    }

    const doc = claimed?.account.doc ?? (await loadAccount(identity)).doc;
    if (!erpReady(doc)) return; // nothing was claimed; nothing to send
    let token = options.token;
    if (!token) {
      const session = await login(identity, doc);
      if (!session.ok) {
        await update(identity, ({ doc: fresh }) => {
          const erp = (fresh.erp ??= {});
          if (session.error === "erp_register_busy") {
            // Another request is registering: nothing was tried, so the
            // claimed work goes back exactly as it was — no attempt spent.
            releaseClaim(fresh, work);
            return true;
          }
          applyOutcome(fresh, work, null, session.error, new Date());
          noteLoginFailure(fresh, session);
          if (pull && !NOT_READY.has(session.error)) {
            erp.pullFailures = (erp.pullFailures ?? 0) + 1;
            erp.pullFailedAt = new Date().toISOString();
          }
          return true;
        });
        return;
      }
      token = session.value;
      await recordLinked(identity, doc);
    }

    const outcome =
      work.local || work.apps.length > 0
        ? await flush({
            doc,
            token,
            identity: pushIdentity(identity),
            local: work.local,
            apps: work.apps,
            loadCv: () => readCv(identity.email),
            loadPicture: () => readPicture(identity.email),
          })
        : null;
    const snapshot = pull ? await fetchSnapshot(token) : null;

    let cancelQueued = false;
    await update(identity, (account) => {
      const now = new Date();
      const before = queuedCancels(account.doc);
      if (outcome) applyOutcome(account.doc, work, outcome, undefined, now);
      // Files written to D1 only when the pull brought new content.
      const files = snapshot ? persistSnapshot(account, snapshot) : true;
      cancelQueued = [...queuedCancels(account.doc)].some((id) => !before.has(id));
      return files;
    });
    // A withdrawn application's ERP copy was found in this run: cancel it now
    // (same token), not on some later visit.
    if (cancelQueued && !options.followUp) {
      await syncTask(identity, { mode: "retry", token, followUp: true });
    }
  } catch (error) {
    console.error("[erp-sync]", "sync_crashed", "-", String(error));
  }
}

/* --- scheduling helpers for /api/me ------------------------------------- */

/** Marks the document as having a sync scheduled (dedupes `after()` tasks). */
export function markScheduled(doc: ApplicantDoc, now = new Date()): void {
  (doc.erp ??= {}).scheduledAt = now.toISOString();
}
