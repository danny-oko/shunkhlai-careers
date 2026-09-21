import "server-only";

import {
  AccountConflictError,
  type ClerkIdentity,
  type LoadedAccount,
  loadAccount,
  readCv,
  saveAccount,
} from "./account-store";
import {
  type ApplicationErp,
  type PushResult,
  createPushBatch,
  isDue,
  pushApplication,
  withdrawFromErp,
} from "./erp-push";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * Runs the ERP push around D1 (called from `after()` in `/api/me`, so never on
 * the request path). Every D1 write loads the account fresh and changes only
 * the rows it owns, re-trying when the optimistic lock says someone else saved.
 */

const SAVE_TRIES = 3;

const findApp = (doc: ApplicantDoc, entryid: number) =>
  doc.applications.find((row) => Number(row.entryid) === entryid);

/** Load → change → save, re-run on a lock conflict. `change` false = no write. */
async function update(
  identity: ClerkIdentity,
  change: (account: LoadedAccount) => boolean,
): Promise<LoadedAccount | null> {
  for (let attempt = 0; attempt < SAVE_TRIES; attempt += 1) {
    const account = await loadAccount(identity);
    if (!change(account)) return null;
    try {
      await saveAccount(account, identity, account.nextEntryId);
      return account;
    } catch (error) {
      if (!(error instanceof AccountConflictError)) throw error;
    }
  }
  return null;
}

/** A freshly submitted row's `erp`: claimed as attempt 1. */
export function pendingErp(now = new Date()): ApplicationErp {
  return { status: "pending", attempts: 1, lastAttemptAt: now.toISOString() };
}

async function persist(identity: ClerkIdentity, entryid: number, result: PushResult) {
  await update(identity, ({ doc }) => {
    const row = findApp(doc, entryid);
    if (!row) return false; // withdrawn meanwhile
    const previous = (row.erp ?? {}) as Partial<ApplicationErp>;
    const erp: ApplicationErp = {
      status: result.status,
      attempts: previous.attempts ?? 1,
      lastAttemptAt: previous.lastAttemptAt ?? new Date().toISOString(),
    };
    if (result.error) erp.error = result.error;
    const erpEntryId = result.erpEntryId ?? previous.erpEntryId;
    if (erpEntryId) erp.erpEntryId = erpEntryId;
    row.erp = erp;
    if (result.cvHash) doc.erp = { ...doc.erp, cvHash: result.cvHash };
    return true;
  });
}

function pushDeps(identity: ClerkIdentity) {
  return {
    identity: { firstname: identity.firstname, lastname: identity.lastname, email: identity.email },
    loadCv: () => readCv(identity.email),
    batch: createPushBatch(),
  };
}

async function pushRows(account: LoadedAccount, identity: ClerkIdentity, rows: Row[]) {
  const deps = pushDeps(identity); // one ERP login for the whole batch
  for (const row of rows) {
    const result = await pushApplication(account.doc, row, deps);
    await persist(identity, Number(row.entryid), result);
  }
}

/** After a submit: push the row that was just saved as pending. */
export async function pushSubmitted(identity: ClerkIdentity, entryid: number): Promise<void> {
  try {
    const account = await loadAccount(identity);
    const row = findApp(account.doc, entryid);
    if (row) await pushRows(account, identity, [row]);
  } catch (error) {
    console.error("[erp-push]", "push_crashed", "SaveHrRecruitmentOrderApp", String(error));
  }
}

/**
 * On an /account visit: claim the rows that are due (count the attempt and
 * stamp the time, so a parallel visit does not push them too), then push.
 */
export async function retryDue(identity: ClerkIdentity): Promise<void> {
  try {
    let claimed: number[] = [];
    const account = await update(identity, ({ doc }) => {
      const now = new Date();
      const due = doc.applications.filter((row) => isDue(row, now.getTime()));
      claimed = due.map((row) => Number(row.entryid));
      for (const row of due) {
        const erp = row.erp as ApplicationErp;
        row.erp = { ...erp, attempts: (erp.attempts ?? 0) + 1, lastAttemptAt: now.toISOString() };
      }
      return due.length > 0;
    });
    if (!account) return;
    const rows = claimed.map((id) => findApp(account.doc, id)).filter((row): row is Row => !!row);
    await pushRows(account, identity, rows);
  } catch (error) {
    console.error("[erp-push]", "retry_crashed", "-", String(error));
  }
}

/** True when a visit should schedule `retryDue`. */
export const hasDuePushes = (doc: ApplicantDoc) => doc.applications.some((row) => isDue(row));

/** After a D1 withdrawal: withdraw the ERP copy too (best-effort). */
export async function withdrawSubmitted(doc: ApplicantDoc, erpEntryId: number): Promise<void> {
  await withdrawFromErp(doc, erpEntryId);
}
