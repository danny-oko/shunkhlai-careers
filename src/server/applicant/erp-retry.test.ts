import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  MAX_RETRY_DELAY_MS,
  MIN_RETRY_DELAY_MS,
  PUSH_STATUSES,
  RETRY_BASE_MS,
  RETRY_CAP_MS,
  RETRY_JITTER,
  classifyPushError,
  idempotencyKey,
  isPushStatus,
  isRetryableReason,
  isWaitingReason,
  retryDelayMs,
} from "./erp-retry";

/**
 * The retry policy on its own. No database, no `fetch`, no ERP — the whole
 * point of this module having no imports is that its rules can be checked
 * without any of that standing in the way.
 */

/** An `ErpError` as `erp.ts` builds one, without importing the transport. */
function erpError(status?: number, rettype?: number, message = "боом") {
  const error = new Error(message);
  error.name = "ErpError";
  return Object.assign(error, { endpoint: "SaveHrRecruitmentOrderApp", status, rettype });
}

describe("the state machine", () => {
  it("is a closed set of names", () => {
    expect([...PUSH_STATUSES]).toEqual(["pending", "sent", "failed", "skipped"]);
    expect(isPushStatus("pending")).toBe(true);
    expect(isPushStatus("pushed")).toBe(false);
    expect(isPushStatus(undefined)).toBe(false);
  });
});

describe("classifyPushError", () => {
  it("a request that never completed is retryable", () => {
    // `erp.ts` throws these with no status at all.
    expect(classifyPushError(erpError(undefined, undefined, "timeout"))).toEqual({
      reason: "erp_unreachable",
      retryable: true,
    });
    expect(classifyPushError(erpError(undefined, undefined, "network")).retryable).toBe(true);
  });

  it("5xx, 429 and 408 are the ERP's problem, so they are retryable", () => {
    for (const status of [500, 502, 503, 504, 408, 429]) {
      expect(classifyPushError(erpError(status))).toEqual({
        reason: "erp_unavailable",
        retryable: true,
      });
    }
  });

  it("a 4xx means the payload was read and refused: never retried", () => {
    for (const status of [400, 403, 404, 409, 422]) {
      expect(classifyPushError(erpError(status))).toEqual({
        reason: "erp_apply_rejected",
        retryable: false,
      });
    }
  });

  it("a refusal dressed as a 200 (rettype ≠ 0) is refused all the same", () => {
    expect(classifyPushError(erpError(200, 1))).toEqual({
      reason: "erp_apply_rejected",
      retryable: false,
    });
    expect(classifyPushError(erpError(200, 0)).retryable).toBe(true);
  });

  it("anything that is not an ERP failure is our bug, not a verdict: retryable", () => {
    expect(classifyPushError(new TypeError("undefined is not a function")).retryable).toBe(true);
    expect(classifyPushError("nope").retryable).toBe(true);
    expect(classifyPushError(undefined).retryable).toBe(true);
  });

  it("never carries the upstream text into its answer", () => {
    const secret = "Бат Доржийн РД АА12345678 давхардлаа";
    const classified = classifyPushError(erpError(400, 1, secret));
    expect(JSON.stringify(classified)).not.toContain("АА12345678");
    expect(JSON.stringify(classified)).not.toContain("Бат");
  });
});

describe("reason predicates", () => {
  it("only a refusal is non-retryable", () => {
    expect(isRetryableReason("erp_apply_rejected")).toBe(false);
    for (const reason of ["erp_unreachable", "erp_unavailable", "erp_apply_failed", "erp_login_failed", undefined]) {
      expect(isRetryableReason(reason)).toBe(true);
    }
  });

  it("waiting on the applicant is not failing", () => {
    expect(isWaitingReason("profile_incomplete")).toBe(true);
    expect(isWaitingReason("erp_withdraw_pending")).toBe(true);
    expect(isWaitingReason("erp_unavailable")).toBe(false);
  });
});

describe("retryDelayMs", () => {
  const KEYS = Array.from({ length: 200 }, (_, i) => `key-${i}`);

  it("doubles with the attempt, in the middle of the jitter band", () => {
    // Averaged over many keys the jitter cancels, leaving the exponential.
    const mean = (attempts: number) =>
      KEYS.reduce((sum, key) => sum + retryDelayMs(attempts, key), 0) / KEYS.length;
    expect(mean(1)).toBeGreaterThan(RETRY_BASE_MS * 0.9);
    expect(mean(1)).toBeLessThan(RETRY_BASE_MS * 1.1);
    expect(mean(2) / mean(1)).toBeGreaterThan(1.8);
    expect(mean(3) / mean(2)).toBeGreaterThan(1.8);
  });

  it("stays inside its stated bounds for every attempt and key", () => {
    for (const key of KEYS) {
      for (let attempts = 1; attempts <= MAX_ATTEMPTS + 5; attempts += 1) {
        const delay = retryDelayMs(attempts, key);
        expect(delay).toBeGreaterThanOrEqual(MIN_RETRY_DELAY_MS);
        expect(delay).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS);
        // And inside the ±jitter band around its own capped step.
        const step = Math.min(RETRY_BASE_MS * 2 ** (Math.min(attempts, MAX_ATTEMPTS) - 1), RETRY_CAP_MS);
        expect(delay).toBeLessThanOrEqual(Math.round(step * (1 + RETRY_JITTER)));
        expect(delay).toBeGreaterThanOrEqual(Math.round(step * (1 - RETRY_JITTER)));
      }
    }
  });

  it("is capped: the series never runs away", () => {
    expect(retryDelayMs(99, "k")).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS);
    expect(MAX_RETRY_DELAY_MS).toBe(Math.round(RETRY_CAP_MS * (1 + RETRY_JITTER)));
  });

  it("is stable for one row and spread across rows", () => {
    // Stable: `isDue` is asked the same question by the claim, the sweep and
    // the desk, and they have to agree.
    expect(retryDelayMs(3, "same")).toBe(retryDelayMs(3, "same"));
    // Spread: a hundred rows that failed in the same outage do not all come
    // back at the same instant.
    const distinct = new Set(KEYS.map((key) => retryDelayMs(3, key)));
    expect(distinct.size).toBeGreaterThan(KEYS.length * 0.9);
  });

  it("the exponential stops climbing past the attempt cap", () => {
    // Only the jitter differs past MAX_ATTEMPTS; the step underneath is the
    // same one. (A row that far along is terminal anyway — this is the
    // guarantee that a stored row from an older build cannot ask for a week.)
    const step = Math.min(RETRY_BASE_MS * 2 ** (MAX_ATTEMPTS - 1), RETRY_CAP_MS);
    for (const attempts of [MAX_ATTEMPTS, MAX_ATTEMPTS + 1, 99]) {
      expect(retryDelayMs(attempts, "k")).toBeLessThanOrEqual(Math.round(step * (1 + RETRY_JITTER)));
      expect(retryDelayMs(attempts, "k")).toBeGreaterThanOrEqual(Math.round(step * (1 - RETRY_JITTER)));
    }
  });
});

describe("idempotencyKey", () => {
  it("is stable for one applicant and posting, whatever the retry", () => {
    expect(idempotencyKey("A@B.MN ", 786)).toBe(idempotencyKey("a@b.mn", "786"));
  });

  it("separates postings and applicants", () => {
    expect(idempotencyKey("a@b.mn", 786)).not.toBe(idempotencyKey("a@b.mn", 787));
    expect(idempotencyKey("a@b.mn", 786)).not.toBe(idempotencyKey("c@d.mn", 786));
  });

  it("does not carry the email it was made from", () => {
    const key = idempotencyKey("bat.dorj@example.mn", 786);
    expect(key).not.toContain("bat");
    expect(key).toMatch(/^[0-9a-f]{24}$/);
  });
});
