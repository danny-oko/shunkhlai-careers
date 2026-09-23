import "server-only";
import { asc } from "drizzle-orm";

import { applicantAccount, getDb } from "@/lib/db";
import {
  AccountConflictError,
  type ClerkIdentity,
  loadAccount,
  normalizeEmail,
  saveAccount,
} from "./account-store";
import { CLAIM_TTL_MS } from "./erp-model";
import { type ApplicationErp, isDue, isTerminal } from "./erp-push";
import { MAX_ATTEMPTS, idempotencyKey } from "./erp-retry";
import { syncTask } from "./erp-sync";
import type { Row } from "./handlers";

/**
 * The stuck-application desk, and the sweep behind it.
 *
 * An application is durable in `applicant_account.data_json` the moment the
 * applicant submits it; the ERP push that follows may fail, and normally the
 * retry rides along on the applicant's next visit. Two cases that does not
 * cover, and this file is both of them:
 *
 * 1. the process died between the local write and the push, and the applicant
 *    never comes back — nothing would ever look at the row again;
 * 2. the row went terminal (refused, or out of attempts) and has to stop being
 *    a silent failure and become something a human is looking at.
 *
 * Everything here reads the same rows the applicant's own document holds. There
 * is no second table: an application has one home, and a mirror of it would be
 * one more thing that can disagree with the ERP.
 */

/** A row nobody has touched for this long, still unsent, is worth surfacing. */
export const STALE_AFTER_MS = 30 * 60_000;

/** How many accounts one sweep will push for. Keeps a cron tick bounded. */
export const SWEEP_LIMIT = 25;

/**
 * One line of the admin list. Deliberately narrow: the applicant's email (the
 * account key, and how HR finds them), the posting, and the push state. No
 * регистр, no phone, no CV — the desk exists to unstick a push, not to browse
 * applicants — and `error` is a classified code, never an ERP message.
 */
export type StuckApplication = {
  email: string;
  entryid: number;
  recruitmentorderid: number;
  posname: string;
  status: string;
  attempts: number;
  /** A classified reason (`FailureReason` or a login/flush code), if any. */
  error?: string;
  /** Retrying is over: refused by the ERP, or out of attempts. */
  terminal: boolean;
  submittedAt?: string;
  lastAttemptAt?: string;
  /** `idempotencyKey` — the same string across every retry of this row. */
  key: string;
};

const appErp = (row: Row): ApplicationErp | undefined =>
  row.erp && typeof row.erp === "object" ? (row.erp as ApplicationErp) : undefined;

const parseTime = (iso: string | undefined) => {
  const at = Date.parse(iso ?? "");
  return Number.isFinite(at) ? at : undefined;
};

/**
 * Is this row stuck rather than merely in flight? Terminal rows always are.
 * Otherwise it must be unsent, unclaimed and older than `STALE_AFTER_MS` — a
 * push that started ten seconds ago is not stuck, it is working.
 */
function isStuck(erp: ApplicationErp, now: number): boolean {
  if (erp.status !== "pending" && erp.status !== "failed") return false;
  if (isTerminal(erp)) return true;
  const claimed = parseTime(erp.claimedAt);
  if (claimed !== undefined && now - claimed < CLAIM_TTL_MS) return false;
  const last = parseTime(erp.lastAttemptAt) ?? parseTime(erp.submittedAt);
  return last === undefined || now - last >= STALE_AFTER_MS;
}

/** Every account row, oldest first. Small table; the desk reads it whole. */
const allAccounts = () =>
  getDb()
    .select({
      email: applicantAccount.email,
      clerkUserId: applicantAccount.clerkUserId,
      dataJson: applicantAccount.dataJson,
    })
    .from(applicantAccount)
    .orderBy(asc(applicantAccount.createdAt));

type StoredShape = { profile?: Row; applications?: Row[] };

function parse(json: string): StoredShape {
  try {
    const raw = JSON.parse(json) as unknown;
    return raw && typeof raw === "object" ? (raw as StoredShape) : {};
  } catch {
    // A document we cannot parse has no applications we can push; the loader
    // (`parseStored`) treats it the same way, so it is not a new failure mode.
    return {};
  }
}

const identityOf = (email: string, clerkUserId: string | null, profile: Row | undefined): ClerkIdentity => ({
  clerkUserId: clerkUserId ?? "",
  email,
  firstname: String(profile?.firstname ?? ""),
  lastname: String(profile?.lastname ?? ""),
});

/** Applications waiting on the ERP longer than they should be, newest first. */
export async function listStuckApplications(now = Date.now()): Promise<StuckApplication[]> {
  const out: StuckApplication[] = [];
  for (const account of await allAccounts()) {
    const stored = parse(account.dataJson);
    for (const row of stored.applications ?? []) {
      const erp = appErp(row);
      if (!erp || !isStuck(erp, now)) continue;
      out.push({
        email: account.email,
        entryid: Number(row.entryid),
        recruitmentorderid: Number(row.recruitmentorderid) || 0,
        posname: String(row.posname ?? ""),
        status: erp.status,
        attempts: erp.attempts ?? 0,
        ...(erp.error ? { error: erp.error } : {}),
        terminal: isTerminal(erp),
        ...(erp.submittedAt ? { submittedAt: erp.submittedAt } : {}),
        ...(erp.lastAttemptAt ? { lastAttemptAt: erp.lastAttemptAt } : {}),
        key: erp.key ?? idempotencyKey(account.email, row.recruitmentorderid),
      });
    }
  }
  const at = (row: StuckApplication) => parseTime(row.submittedAt) ?? parseTime(row.lastAttemptAt) ?? 0;
  return out.sort((a, b) => at(b) - at(a));
}

/* --- retry -------------------------------------------------------------- */

export type RetryResult = { ok: boolean; reason?: "not_found" | "conflict" };

/**
 * Hands one row back to the sync: `pending`, attempts reset, terminal cleared.
 *
 * This is the only way out of `terminal`, and it is a person's decision on
 * purpose. A row is terminal because the ERP refused the payload or because
 * five pushes failed; a retry that happened by itself would just re-bury it.
 *
 * The push that follows is not guaranteed to be the first one the ERP sees for
 * this application — see the idempotency note in `docs/applications.md`. It is
 * safe to press twice in the ordinary case: `pushApplication` reads the ERP's
 * own `appliedOrderIds` first and treats its duplicate refusal as success.
 */
export async function retryApplication(rawEmail: string, entryid: number): Promise<RetryResult> {
  const email = normalizeEmail(rawEmail);
  const [account] = (await allAccounts()).filter((row) => row.email === email);
  if (!account) return { ok: false, reason: "not_found" };
  const identity = identityOf(email, account.clerkUserId, parse(account.dataJson).profile);

  const loaded = await loadAccount(identity);
  const row = loaded.doc.applications.find((r) => Number(r.entryid) === entryid);
  const erp = row ? appErp(row) : undefined;
  if (!row || !erp) return { ok: false, reason: "not_found" };

  row.erp = {
    status: "pending",
    attempts: 0,
    lastAttemptAt: new Date(0).toISOString(), // due immediately
    ...(erp.erpEntryId ? { erpEntryId: erp.erpEntryId } : {}),
    ...(erp.submittedAt ? { submittedAt: erp.submittedAt } : {}),
    key: erp.key ?? idempotencyKey(email, row.recruitmentorderid),
  } satisfies ApplicationErp;

  try {
    await saveAccount(loaded, identity, loaded.nextEntryId);
  } catch (error) {
    // Somebody else wrote this account between the load and the save — very
    // likely the applicant themselves, or a sweep already pushing this row.
    // Saying so beats overwriting their work with a stale document.
    if (error instanceof AccountConflictError) return { ok: false, reason: "conflict" };
    throw error;
  }

  await syncTask(identity, { mode: "retry" });
  return { ok: true };
}

/* --- sweep -------------------------------------------------------------- */

export type SweepReport = { scanned: number; claimed: number };

/**
 * Picks up applications whose push never happened or never finished.
 *
 * **Concurrency.** Two instances running this at the same time is expected
 * (two app servers, or a cron tick landing on a visiting applicant), and the
 * row is protected twice over:
 *
 * - `syncTask` claims before it sends. The claim is a `claimedAt` stamp
 *   written inside `applicant_account`'s optimistic lock — the `UPDATE` carries
 *   `WHERE updated_at = <value read>`, so of two instances exactly one writes
 *   and the other gets `AccountConflictError`, reloads, sees the fresh stamp,
 *   and claims nothing.
 * - `isDue()` ignores a row claimed less than `CLAIM_TTL_MS` ago, so the
 *   loser skips the row rather than racing it.
 *
 * What that buys, precisely: **two sweeps will not both send the same
 * application**, because the lease is taken under a compare-and-set on the row
 * that holds it. What it does not buy: a claim older than `CLAIM_TTL_MS` is
 * reclaimed, so an instance that hung mid-push for longer than the lease can
 * have a second push start while its first is still on the wire. That window
 * is real and is the reason the ERP-side guarantee in `docs/applications.md` is
 * "at least once", not "exactly once".
 */
export async function sweepStuckApplications(
  { limit = SWEEP_LIMIT, now = Date.now() }: { limit?: number; now?: number } = {},
): Promise<SweepReport> {
  const accounts = await allAccounts();
  let claimed = 0;
  for (const account of accounts) {
    if (claimed >= limit) break;
    const stored = parse(account.dataJson);
    // Cheap pre-filter on the row we already read, so an account with nothing
    // due costs no extra query. `syncTask` re-reads and re-checks under the
    // lock; this is only about not loading every account on every tick.
    const due = (stored.applications ?? []).some((row) => isDue(row, now));
    if (!due) continue;
    claimed += 1;
    await syncTask(identityOf(account.email, account.clerkUserId, stored.profile), { mode: "retry" });
  }
  return { scanned: accounts.length, claimed };
}

export { MAX_ATTEMPTS };
