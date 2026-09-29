import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { applicantAccount, applicationLog, getDb } from "@/lib/db";
import { ErpError, erpPublicGet, hasErp } from "./erp";
import { type ApplicationErp, isTerminal } from "./erp-push";
import { type PushStatus, classifyPushError, idempotencyKey, isPushStatus } from "./erp-retry";
import type { Row } from "./handlers";

/**
 * Every application this site has seen, for `/admin/applications`.
 *
 * ## Where the rows come from, and why it is not the ERP
 *
 * The ERP is the system of record (`docs/applications.md`), and this desk
 * would rather read it. It cannot. Every endpoint in the collection that
 * carries an application — `getRecruitmenRequestList`, and the
 * `recruitmentorders` inside `get` — answers for **one applicant**, addressed
 * by a bearer token that `auth/login` mints from that applicant's регистр and
 * phone. There is no admin-scoped listing, and `/api/system/*` is the CMS
 * (companies, sliders, news), not recruitment. So "read every application from
 * the ERP" would mean logging in as each applicant in turn with credentials
 * this desk has no business spending — and it would still only cover the
 * applicants this site knows about, which is exactly the set the mirror
 * already holds.
 *
 * So the list is the mirror: `applicant_account.data_json`, the same rows the
 * applicant's own «Миний хүсэлтүүд» reads. That is a real limitation and the
 * page says so out loud rather than implying completeness — the mirror holds
 * what passed through this site since launch, and nothing an applicant sent
 * the ERP by another route.
 *
 * ## What the ERP is still asked
 *
 * One public read, `getRecruitmentOrderList` — the same postings the careers
 * pages render, no token, no applicant. It answers two questions the mirror
 * cannot: is the ERP answering at all right now, and is the posting somebody
 * applied to still advertised. When it fails the desk keeps every row and says
 * which half of the screen it lost (`DeskSource` below).
 *
 * ## PII
 *
 * The list shape carries a display name and nothing else about the person: no
 * регистр, no phone, no email, no CV. `DeskApplicationDetail` adds the account
 * email, because that is how HR finds the applicant and the detail view is a
 * deliberate open rather than a browse. Nothing upstream is ever copied onto
 * either shape — `error` is a classified code (`erp-retry.ts`), and the two
 * places a raw ERP message is stored (`erp.withdrawRefused` in the document,
 * `application_log.error_message` in the legacy table) are dropped here and
 * never reach a component.
 */

/* --- shapes -------------------------------------------------------------- */

/** Where the copy to the ERP stands, as this desk reads it off the row. */
export type DeskPush = {
  status: PushStatus | "unknown";
  attempts: number;
  /** Nobody is retrying any more: refused, or out of attempts. */
  terminal: boolean;
  /** A classified short code (`FailureReason` or a login/flush code). */
  error?: string;
  lastAttemptAt?: string;
  submittedAt?: string;
  /** The request number the ERP knows it by, once a push has landed. */
  erpEntryId?: number;
};

/**
 * One line of the list.
 *
 * Deliberately narrow, and the narrowness is the point: a desk that can be
 * read over somebody's shoulder shows a name, a job, a date and a push state.
 * The account email is not here — see `DeskApplicationDetail`.
 */
export type DeskApplication = {
  /**
   * `idempotencyKey(email, recruitmentorderid)` — the row's address.
   *
   * The detail view is `/admin/applications/<key>` rather than
   * `?email=…&entryid=…` for the reason the key was hashed in the first place
   * (`erp-retry.ts`): a URL is copied into chat, a bookmark and an access log,
   * and an applicant's email address does not need to be in any of them.
   */
  key: string;
  /** «Овог Нэр», as `session-provider.tsx` joins them. Empty when unknown. */
  name: string;
  jobTitle: string;
  /** The posting's `entryid`, for `/careers/<id>`. 0 when the row has none. */
  jobId: number;
  /** As stored: `yyyy.mm.dd` from the ERP, or an ISO stamp from a local save. */
  appliedAt: string;
  /** The ERP's own status word for the request, when it sent one. */
  erpStatus: string;
  push: DeskPush;
};

/** The fuller record behind one row. Still no регистр, phone, or CV bytes. */
export type DeskApplicationDetail = DeskApplication & {
  /** The account key. HR's way to reach the applicant; not in the list. */
  email: string;
  /** The row's own id inside the applicant's document. */
  entryid: number;
  company: string;
  location: string;
  salary: string;
  availableFrom: string;
  /** Whether a CV is attached — not its bytes, and not its file name. */
  hasCv: boolean;
  hasPhoto: boolean;
  /**
   * The legacy `application_log` row, when one exists. Its `error_message`
   * column is a raw upstream message from the D1 era and is not read.
   */
  log?: { status: string; erpApplicationId: number | null; createdAt: string };
};

/**
 * What the screen has to tell the reader before it shows them anything.
 *
 * `rows` is `"mirror"` today and the type says so rather than pretending at a
 * choice: see the header. `erp` is the live half — the one public read the
 * desk makes, which decides whether the posting state can be shown.
 */
export type DeskSource = {
  rows: "mirror";
  erp:
    | { reachable: true; postings: number }
    | { reachable: false; reason: "erp_not_configured" | string };
};

export type ApplicationDesk = {
  rows: DeskApplication[];
  source: DeskSource;
  /** Postings still advertised, by `entryid` — empty when the ERP was lost. */
  openPostings: ReadonlySet<number>;
};

/* --- reading the mirror -------------------------------------------------- */

type StoredShape = {
  profile?: Row;
  applications?: Row[];
  cv?: unknown;
  picture?: unknown;
};

function parse(json: string): StoredShape {
  try {
    const raw = JSON.parse(json) as unknown;
    return raw && typeof raw === "object" ? (raw as StoredShape) : {};
  } catch {
    // Same answer the loader gives a document it cannot parse: no applications.
    return {};
  }
}

const appErp = (row: Row): ApplicationErp | undefined =>
  row.erp && typeof row.erp === "object" ? (row.erp as ApplicationErp) : undefined;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** «Овог Нэр», the join `session-provider.tsx` uses for the signed-in name. */
const displayName = (profile: Row | undefined): string =>
  [text(profile?.lastname), text(profile?.firstname)].filter(Boolean).join(" ");

/**
 * The date the desk sorts and prints.
 *
 * `submittedAt` first — it is this site's own stamp, written at the durable
 * save, and it is the only one that exists for a row the ERP has never seen.
 * `senddate` (`yyyy.mm.dd`, from the ERP) is the fallback for rows that were
 * pulled rather than pushed.
 */
const appliedAt = (row: Row, erp: ApplicationErp | undefined): string =>
  text(erp?.submittedAt) || text(row.senddate) || text(row.requestdate);

/** Milliseconds for sorting. `yyyy.mm.dd` and ISO both parse once normalised. */
export function appliedAtMs(value: string): number {
  const at = Date.parse(value.replace(/^(\d{4})\.(\d{2})\.(\d{2})$/u, "$1-$2-$3"));
  return Number.isFinite(at) ? at : 0;
}

function pushOf(erp: ApplicationErp | undefined): DeskPush {
  if (!erp) return { status: "unknown", attempts: 0, terminal: false };
  return {
    status: isPushStatus(erp.status) ? erp.status : "unknown",
    attempts: Number(erp.attempts) || 0,
    terminal: isTerminal(erp),
    ...(erp.error ? { error: String(erp.error) } : {}),
    ...(erp.lastAttemptAt ? { lastAttemptAt: erp.lastAttemptAt } : {}),
    ...(erp.submittedAt ? { submittedAt: erp.submittedAt } : {}),
    ...(Number(erp.erpEntryId) > 0 ? { erpEntryId: Number(erp.erpEntryId) } : {}),
  };
}

/** Every account row, oldest first. A small table; the desk reads it whole. */
const allAccounts = () =>
  getDb()
    .select({
      email: applicantAccount.email,
      clerkUserId: applicantAccount.clerkUserId,
      dataJson: applicantAccount.dataJson,
    })
    .from(applicantAccount)
    .orderBy(asc(applicantAccount.createdAt));

type Flat = {
  row: DeskApplication;
  email: string;
  clerkUserId: string | null;
  source: Row;
  stored: StoredShape;
};

/** Every application in the mirror, flattened and stripped, newest first. */
async function flatten(): Promise<Flat[]> {
  const out: Flat[] = [];
  for (const account of await allAccounts()) {
    const stored = parse(account.dataJson);
    const name = displayName(stored.profile);
    for (const source of stored.applications ?? []) {
      const erp = appErp(source);
      out.push({
        email: account.email,
        clerkUserId: account.clerkUserId,
        source,
        stored,
        row: {
          key: text(erp?.key) || idempotencyKey(account.email, source.recruitmentorderid),
          name,
          jobTitle: text(source.posname),
          jobId: Number(source.recruitmentorderid) || 0,
          appliedAt: appliedAt(source, erp),
          erpStatus: text(source.statusname),
          push: pushOf(erp),
        },
      });
    }
  }
  return out.sort((a, b) => appliedAtMs(b.row.appliedAt) - appliedAtMs(a.row.appliedAt));
}

/** Every application the mirror holds, newest first. */
export async function listApplications(): Promise<DeskApplication[]> {
  return (await flatten()).map((entry) => entry.row);
}

/* --- the one ERP read ---------------------------------------------------- */

/** Just enough of `getRecruitmentOrderList` for "is this posting still open". */
type PostingRow = { entryid?: unknown; remainingdays?: unknown };

/**
 * Postings the ERP is still advertising.
 *
 * Throws on any failure so the caller can classify it the way the push path
 * does — from the transport's own metadata, never from the response body.
 */
async function openPostings(): Promise<Set<number>> {
  // The three parameters `lib/api/jobs.ts` sends, all empty: every posting.
  const query = new URLSearchParams({ jobName: "", locationid: "0", salaryLevelID: "" });
  const rows = await erpPublicGet<PostingRow[] | null>(
    "getRecruitmentOrderList",
    `?${query.toString()}`,
  );
  const open = new Set<number>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = Number(row?.entryid);
    const remaining = Number(row?.remainingdays);
    // `null` remainingdays is an open-ended advert, not one expiring today.
    if (id > 0 && !(remaining < 0)) open.add(id);
  }
  return open;
}

/**
 * Ask the ERP whether it is there, and what is still advertised.
 *
 * Exported because the detail view needs the same answer as the list: the
 * source line belongs on both screens, and a reader who followed a link should
 * not have to go back to find out where the record came from.
 */
export async function deskSource(): Promise<{ source: DeskSource; openPostings: Set<number> }> {
  if (!hasErp()) {
    return {
      source: { rows: "mirror", erp: { reachable: false, reason: "erp_not_configured" } },
      openPostings: new Set(),
    };
  }
  try {
    const postings = await openPostings();
    return {
      source: { rows: "mirror", erp: { reachable: true, postings: postings.size } },
      openPostings: postings,
    };
  } catch (error) {
    // Classified from the transport, like `classifyPushError` everywhere else:
    // the ERP's own words are not read and are not shown.
    const { reason } = classifyPushError(error);
    console.error(
      "[admin/applications] erp unreachable:",
      reason,
      error instanceof ErpError ? error.endpoint : "-",
    );
    return {
      source: { rows: "mirror", erp: { reachable: false, reason } },
      openPostings: new Set(),
    };
  }
}

/* --- the desk ------------------------------------------------------------ */

/**
 * The list, and where it came from.
 *
 * The two reads run together and neither can take the other down: a dead ERP
 * still leaves every row on screen, and a dead database is the caller's to
 * report (the page turns it into the same notice the newsroom desk uses).
 */
export async function loadApplicationDesk(): Promise<ApplicationDesk> {
  const [rows, erp] = await Promise.all([listApplications(), deskSource()]);
  return { rows, source: erp.source, openPostings: erp.openPostings };
}

/**
 * One application, addressed by its idempotency key.
 *
 * Scanned rather than queried: the key is a hash held inside a JSON document,
 * so there is nothing to index on, and the table is the same one the list
 * already reads whole. Null when no row matches — a hand-typed key, or an
 * application that has since been withdrawn.
 */
export async function getApplication(key: string): Promise<DeskApplicationDetail | null> {
  const entry = (await flatten()).find((candidate) => candidate.row.key === key);
  if (!entry) return null;

  const { row, source, stored, email, clerkUserId } = entry;
  return {
    ...row,
    email,
    entryid: Number(source.entryid) || 0,
    company: text(source.companyname),
    location: text(source.locname),
    salary: text(source.salaryname),
    availableFrom: text(source.availabledate) || text(source.poshiredate),
    hasCv: Boolean(stored.cv),
    hasPhoto: stored.picture === true,
    ...((await legacyLog(clerkUserId, row.jobId)) ?? {}),
  };
}

/**
 * The `application_log` row for this application, if the D1 import left one.
 *
 * Nothing writes this table any more: the importer that filled it was deleted
 * with the rest of the D1 code, and its unique index is one row per
 * (user, job), so it is a state row rather than a history. It is read anyway
 * because on an account carried over from D1 it is the only trace of an
 * attempt older than the current document. When those accounts have aged out,
 * the table and this read can go together.
 *
 * **`error_message` is not selected.** It was written in the D1 era straight
 * from the upstream failure, so it can hold the ERP's `retmsg` — which has
 * been seen echoing an applicant's own name and register number back at the
 * caller. The columns below are ours.
 */
async function legacyLog(
  clerkUserId: string | null,
  jobId: number,
): Promise<{ log: DeskApplicationDetail["log"] } | null> {
  if (!clerkUserId || !jobId) return null;
  try {
    const [found] = await getDb()
      .select({
        status: applicationLog.status,
        erpApplicationId: applicationLog.erpApplicationId,
        createdAt: applicationLog.createdAt,
      })
      .from(applicationLog)
      .where(and(eq(applicationLog.clerkUserId, clerkUserId), eq(applicationLog.jobId, jobId)))
      .limit(1);
    if (!found) return null;
    return {
      log: {
        status: found.status,
        erpApplicationId: found.erpApplicationId,
        createdAt: found.createdAt.toISOString(),
      },
    };
  } catch (error) {
    // A legacy table that cannot be read is not a reason to withhold the
    // application itself.
    console.error("[admin/applications] application_log read failed:", error);
    return null;
  }
}

/** The account and row id behind a key, for an action that has to write. */
export async function resolveApplication(
  key: string,
): Promise<{ email: string; entryid: number } | null> {
  const entry = (await flatten()).find((candidate) => candidate.row.key === key);
  return entry ? { email: entry.email, entryid: Number(entry.source.entryid) || 0 } : null;
}
