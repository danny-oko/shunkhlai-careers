import { createHash } from "node:crypto";

/**
 * The retry policy for an application's ERP push, as pure functions.
 *
 * The site is not the system of record — the ERP is — but the application is
 * durable here before anything is sent (`/api/me` saves the row, then the push
 * runs in `after()`; see `src/app/api/me/[...path]/route.ts`). So this module
 * only has to answer two questions, and never "was it saved": *is this failure
 * worth trying again*, and *how long should the next try wait*.
 *
 * It lives beside `erp-model.ts` rather than inside it because the policy is
 * the part most likely to be tuned against the live ERP, and a reader looking
 * for "why did this stop retrying" should find one file, not a section.
 *
 * It imports nothing but `node:crypto`. That is deliberate: the policy is
 * asked about by the request path, the background sync, the admin desk and the
 * browser-facing formatter, and a module with no `import "server-only"` in its
 * graph can be read from all of them and unit-tested on its own.
 */

/* --- the state machine -------------------------------------------------- */

/**
 * The states an application row's `erp.status` can hold. Listed as a tuple so
 * the union below is derived from it and a stray string cannot slip in:
 *
 *   pending  — saved here, not yet accepted by the ERP. The applicant is told
 *              "submitted, syncing", which is true: the row is durable.
 *   sent     — the ERP has it (the spec's "pushed"; the name is the repo's own
 *              and is left alone so the pulled rows in `mergeApplications` and
 *              every stored document keep reading back the same).
 *   failed   — the last push did not land. Retryable unless `terminal` is set.
 *   skipped  — there is no ERP configured (mock mode). Not a failure, and the
 *              applicant is shown nothing rather than a false "syncing".
 *
 * Transitions, and nothing else:
 *
 *   pending → sent | failed | skipped
 *   failed  → sent | failed (attempt spent) | failed+terminal
 *   sent    → (final; a withdrawal removes the row, it does not move back)
 *   failed+terminal → pending, but only by an explicit admin retry
 *                     (`resetForRetry`), never by the sweep.
 */
export const PUSH_STATUSES = ["pending", "sent", "failed", "skipped"] as const;

export type PushStatus = (typeof PUSH_STATUSES)[number];

export const isPushStatus = (value: unknown): value is PushStatus =>
  typeof value === "string" && (PUSH_STATUSES as readonly string[]).includes(value);

/**
 * The classified reasons a push can fail. Short codes, because they are stored
 * on the row and rendered to the applicant: an upstream body may carry the
 * applicant's own name, регистр or phone back at us, and `retmsg` has been
 * seen doing exactly that on the link endpoints (`erp-push.ts` keeps those in
 * `linkError` deliberately, for the credentials the applicant must fix). An
 * application's failure has no such need, so nothing upstream is ever copied
 * onto the row — see `classifyPushError`, which reads an `ErpError`'s
 * *metadata* only and throws its message away.
 */
export const RETRYABLE_REASONS = [
  /** The request never completed: abort, DNS, socket. */
  "erp_unreachable",
  /** The ERP answered 5xx / 429 / 408 — its problem, and a later push may land. */
  "erp_unavailable",
  /** Login, profile, CV or the request-list read failed transiently. */
  "erp_apply_failed",
] as const;

export const TERMINAL_REASONS = [
  /** The ERP understood the payload and refused it (4xx, or rettype ≠ 0 on a 2xx). */
  "erp_apply_rejected",
] as const;

export type FailureReason = (typeof RETRYABLE_REASONS)[number] | (typeof TERMINAL_REASONS)[number];

export type Classified = { reason: FailureReason; retryable: boolean };

/**
 * What this policy needs to know about a thrown ERP failure. `ErpError`
 * (`erp.ts`) satisfies it; it is matched structurally rather than with
 * `instanceof` so this module does not have to import the transport layer.
 */
type ErpFailure = { name: string; status?: number; rettype?: number };

const isErpFailure = (error: unknown): error is ErpFailure =>
  error instanceof Error && error.name === "ErpError";

/** Reasons that mean "waiting on the applicant / on other work", not "the ERP failed". */
const NOT_A_FAILURE = new Set([
  "profile_incomplete",
  "erp_link_refused",
  "erp_register_busy",
  "erp_withdraw_pending",
]);

/**
 * Whether an error code already stored on a row should still be retried.
 *
 * Codes this module did not mint (the login and flush codes in `erp-push.ts`,
 * and the "not ready" ones) are treated as retryable: they either clear by
 * themselves once the applicant fills something in, or they are the transport
 * failing. The one code that must stop is the ERP's own refusal of the
 * payload — sending a rejected application 5 times is worse than failing fast,
 * because it hides the row that a human has to look at.
 */
export const isRetryableReason = (reason: string | undefined): boolean =>
  !(TERMINAL_REASONS as readonly string[]).includes(reason ?? "");

export const isWaitingReason = (reason: string | undefined): boolean =>
  NOT_A_FAILURE.has(reason ?? "");

/**
 * An ERP failure, classified from what the transport knows about it and
 * nothing else.
 *
 * `ErpError` (`erp.ts`) carries three things worth reading: the endpoint, the
 * HTTP status, and the envelope's `rettype`. Its `message` is either one of our
 * own words ("timeout" / "network" / "no_token" / `http_<n>`) or the ERP's raw
 * `retmsg` — the latter is never inspected beyond the duplicate test in
 * `erp-push.ts` and is never returned from here.
 *
 * - no status at all → the request did not complete → `erp_unreachable`
 * - 408 / 429 / 5xx → the ERP is unwell, not the payload → `erp_unavailable`
 * - any other 4xx → the ERP read the payload and said no → `erp_apply_rejected`
 * - 2xx with `rettype ≠ 0` → the same refusal, dressed as a 200. The ERP
 *   answers business rejections this way (see `call()` in `erp.ts`), so it is
 *   terminal for the same reason a 400 is. A duplicate is filtered out before
 *   this is ever reached (`isDuplicateApplication`), so a repeat push is not
 *   mistaken for a rejection.
 * - anything that is not an `ErpError` → a bug here, not a verdict from the
 *   ERP → retryable, because we cannot say the application was refused.
 */
export function classifyPushError(error: unknown): Classified {
  if (!isErpFailure(error)) return { reason: "erp_apply_failed", retryable: true };
  const { status, rettype } = error;
  if (status === undefined) return { reason: "erp_unreachable", retryable: true };
  if (status >= 500 || status === 408 || status === 429) {
    return { reason: "erp_unavailable", retryable: true };
  }
  if (status >= 400) return { reason: "erp_apply_rejected", retryable: false };
  if (rettype !== undefined && rettype !== 0) {
    return { reason: "erp_apply_rejected", retryable: false };
  }
  return { reason: "erp_apply_failed", retryable: true };
}

/* --- backoff ------------------------------------------------------------ */

/** Pushes before a row is abandoned. The first one is counted at submit. */
export const MAX_ATTEMPTS = 5;

/** Wait after the first failed attempt. */
export const RETRY_BASE_MS = 60_000;

/** The exponential series never waits longer than this before jitter. */
export const RETRY_CAP_MS = 60 * 60_000;

/** Jitter, as a fraction either side of the computed delay. */
export const RETRY_JITTER = 0.25;

/** No wait this policy can produce is longer than this. Asserted in the tests. */
export const MAX_RETRY_DELAY_MS = Math.round(RETRY_CAP_MS * (1 + RETRY_JITTER));

/** Nor shorter than this. */
export const MIN_RETRY_DELAY_MS = Math.round(RETRY_BASE_MS * (1 - RETRY_JITTER));

/**
 * A stable fraction in [-1, 1) for a row, from its idempotency key and the
 * attempt number.
 *
 * Jitter is normally `Math.random()`. It is a hash here because `isDue()` is
 * a pure predicate that several code paths ask about the same row within one
 * request — the claim, the sweep, the UI — and a random answer would have them
 * disagree, and would make the bound below untestable. Hashing the key instead
 * of the clock still does jitter's actual job: two rows that failed in the
 * same outage get different offsets, so they do not come back in lockstep.
 */
function jitterFraction(key: string, attempts: number): number {
  const digest = createHash("sha256").update(`${key}#${attempts}`).digest();
  // 32 bits, as a fraction of 2^31, signed: [-1, 1).
  const value = digest.readUInt32BE(0);
  return value / 2 ** 31 - 1;
}

/**
 * How long to wait before attempt `attempts + 1`: base × 2^(attempts-1),
 * capped, then jittered by ±`RETRY_JITTER`. Always within
 * [`MIN_RETRY_DELAY_MS`, `MAX_RETRY_DELAY_MS`].
 */
export function retryDelayMs(attempts: number, key: string): number {
  const steps = Math.max(0, Math.min(attempts, MAX_ATTEMPTS) - 1);
  const delay = Math.min(RETRY_BASE_MS * 2 ** steps, RETRY_CAP_MS);
  return Math.round(delay * (1 + RETRY_JITTER * jitterFraction(key, attempts)));
}

/* --- the idempotency key ------------------------------------------------ */

/**
 * The stable key for one application: the applicant's account and the posting
 * they applied to. Two pushes of the same row — a retry, a sweep on another
 * instance, an admin retry — produce the same key, and two different
 * applications never do (the ERP holds at most one application per applicant
 * per posting, which is what its own duplicate refusal enforces).
 *
 * It is hashed rather than stored as `email|orderid` because it is written to
 * the document, appears in the admin list and goes into log lines, and an
 * email address in any of those is PII this feature does not need.
 *
 * **The ERP takes no idempotency key.** `SaveHrRecruitmentOrderApp` accepts
 * `recruitmentorderid`, `sourcetype`, `salrequest`, `poshiredate` and
 * `recsourceid` and nothing else (`applicationPayload` in `erp-push.ts`), so
 * this key cannot be sent. It is ours: it identifies the row across processes
 * and makes the local half of the push repeatable. What it does *not* do is
 * make the remote half repeatable — see `docs/applications.md`.
 */
export function idempotencyKey(email: string, recruitmentorderid: unknown): string {
  const order = Number(recruitmentorderid);
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}|${Number.isFinite(order) ? order : "?"}`)
    .digest("hex")
    .slice(0, 24);
}
