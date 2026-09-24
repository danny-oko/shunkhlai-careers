import { beforeEach, describe, expect, it } from "vitest";

import {
  EMAIL_FREE_ATTEMPTS,
  MAX_IP_FAILURES,
  MAX_THROTTLE_MS,
  THROTTLE_STEP_MS,
  WINDOW_MS,
  clearAddressFailures,
  clearEmailFailures,
  emailFailureCount,
  emailKey,
  isAddressLockedOut,
  recordAddressFailure,
  recordEmailFailure,
  resetRateLimit,
  throttleDelayMs,
} from "./rate-limit";

/**
 * Two brakes with deliberately different characters, tested by moving the
 * clock rather than the wall. The property that matters most is at the bottom:
 * the email brake must never be able to refuse anybody.
 */

const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
const IP = "203.0.113.7";
const EMAIL = "admin@shunkhlai.mn";

beforeEach(() => {
  resetRateLimit();
});

describe("emailKey", () => {
  it("normalises case and spacing, so neither buys extra attempts", () => {
    expect(emailKey("  Admin@Shunkhlai.MN ")).toBe(EMAIL);
  });
});

describe("the address brake — a hard refusal", () => {
  it("is quiet until MAX_IP_FAILURES, then refuses", () => {
    for (let i = 1; i < MAX_IP_FAILURES; i += 1) {
      recordAddressFailure(IP, NOW);
      expect(isAddressLockedOut(IP, NOW), `after ${i}`).toBe(false);
    }

    recordAddressFailure(IP, NOW);
    expect(isAddressLockedOut(IP, NOW)).toBe(true);
  });

  it("counts failures against one address whatever email they target", () => {
    // Spraying one password across many accounts is the attack this half
    // exists for, and it never touches the same email twice.
    for (let i = 0; i < MAX_IP_FAILURES; i += 1) recordAddressFailure(IP, NOW);

    expect(isAddressLockedOut(IP, NOW)).toBe(true);
    expect(isAddressLockedOut("198.51.100.2", NOW)).toBe(false);
  });

  it("counts from the first failure, so failing slowly still refuses", () => {
    for (let i = 0; i < MAX_IP_FAILURES; i += 1) {
      recordAddressFailure(IP, NOW + i * 60_000);
    }
    expect(isAddressLockedOut(IP, NOW + MAX_IP_FAILURES * 60_000)).toBe(true);
  });

  it("forgets once the window has passed", () => {
    for (let i = 0; i < MAX_IP_FAILURES; i += 1) recordAddressFailure(IP, NOW);

    expect(isAddressLockedOut(IP, NOW + WINDOW_MS - 1)).toBe(true);
    expect(isAddressLockedOut(IP, NOW + WINDOW_MS)).toBe(false);
  });

  it("is cleared outright on a success", () => {
    for (let i = 0; i < MAX_IP_FAILURES; i += 1) recordAddressFailure(IP, NOW);
    clearAddressFailures(IP);

    expect(isAddressLockedOut(IP, NOW)).toBe(false);
  });
});

describe("the email brake — a delay", () => {
  it("costs nothing for the first few failures", () => {
    for (let i = 0; i < EMAIL_FREE_ATTEMPTS; i += 1) {
      recordEmailFailure(EMAIL, NOW);
      expect(throttleDelayMs(EMAIL, NOW)).toBe(0);
    }
  });

  it("doubles after that, up to the cap", () => {
    for (let i = 0; i < EMAIL_FREE_ATTEMPTS; i += 1) recordEmailFailure(EMAIL, NOW);

    recordEmailFailure(EMAIL, NOW);
    expect(throttleDelayMs(EMAIL, NOW)).toBe(THROTTLE_STEP_MS);
    recordEmailFailure(EMAIL, NOW);
    expect(throttleDelayMs(EMAIL, NOW)).toBe(THROTTLE_STEP_MS * 2);
    recordEmailFailure(EMAIL, NOW);
    expect(throttleDelayMs(EMAIL, NOW)).toBe(THROTTLE_STEP_MS * 4);

    for (let i = 0; i < 50; i += 1) recordEmailFailure(EMAIL, NOW);
    expect(throttleDelayMs(EMAIL, NOW)).toBe(MAX_THROTTLE_MS);
  });

  it("never returns anything that could be read as a refusal", () => {
    // The whole contract of this half: a number of milliseconds, always
    // finite, never a boolean anyone could branch on to turn someone away.
    for (let i = 0; i < 200; i += 1) recordEmailFailure(EMAIL, NOW);

    const delay = throttleDelayMs(EMAIL, NOW);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBeLessThanOrEqual(MAX_THROTTLE_MS);
  });

  it("slows one address without slowing another", () => {
    for (let i = 0; i < 20; i += 1) recordEmailFailure(EMAIL, NOW);

    expect(throttleDelayMs(EMAIL, NOW)).toBeGreaterThan(0);
    expect(throttleDelayMs("other@shunkhlai.mn", NOW)).toBe(0);
  });

  it("forgets once the window has passed", () => {
    for (let i = 0; i < 20; i += 1) recordEmailFailure(EMAIL, NOW);

    expect(throttleDelayMs(EMAIL, NOW + WINDOW_MS - 1)).toBeGreaterThan(0);
    expect(throttleDelayMs(EMAIL, NOW + WINDOW_MS)).toBe(0);
  });

  it("is cleared outright on a success", () => {
    for (let i = 0; i < 20; i += 1) recordEmailFailure(EMAIL, NOW);
    clearEmailFailures(EMAIL);

    expect(emailFailureCount(EMAIL, NOW)).toBe(0);
    expect(throttleDelayMs(EMAIL, NOW)).toBe(0);
  });

  it("counts a normalised address, so case cannot dodge the delay", () => {
    for (let i = 0; i < 20; i += 1) recordEmailFailure("ADMIN@shunkhlai.MN", NOW);

    expect(throttleDelayMs(EMAIL, NOW)).toBeGreaterThan(0);
  });
});
