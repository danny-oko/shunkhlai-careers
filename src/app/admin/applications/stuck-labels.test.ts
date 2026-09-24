import { describe, expect, it } from "vitest";

import type { StuckApplication } from "@/server/applicant/stuck";
import { REASON_UNKNOWN, deskTime, reasonLabel, stuckVerdict } from "./stuck-labels";

const row = (over: Partial<StuckApplication> = {}): StuckApplication => ({
  email: "bat@example.mn",
  entryid: 1_000_000_001,
  recruitmentorderid: 786,
  posname: "Нягтлан бодогч",
  status: "failed",
  attempts: 2,
  terminal: false,
  key: "abc123",
  ...over,
});

describe("reasonLabel", () => {
  it("names the classified reasons in Mongolian", () => {
    expect(reasonLabel("erp_unreachable")).toBe("ERP-д холбогдож чадсангүй");
    expect(reasonLabel("erp_apply_rejected")).toBe("ERP хүсэлтийг хүлээж авсангүй");
  });

  it("falls back rather than showing a code to a human", () => {
    expect(reasonLabel("something_new")).toBe(REASON_UNKNOWN);
    expect(reasonLabel(undefined)).toBe(REASON_UNKNOWN);
    // Whatever arrives, the label is one of our own strings — an upstream
    // message passed in here is never echoed back out.
    expect(reasonLabel("Бат Доржийн РД АА12345678")).toBe(REASON_UNKNOWN);
  });
});

describe("stuckVerdict", () => {
  it("separates 'still trying' from 'gave up'", () => {
    expect(stuckVerdict(row({ terminal: false }))).toEqual({
      tone: "pending",
      label: "Дахин оролдож байна",
    });
    expect(stuckVerdict(row({ terminal: true }))).toEqual({
      tone: "negative",
      label: "Дахин оролдохоо больсон",
    });
  });
});

describe("deskTime", () => {
  it("formats a timestamp and survives a missing or broken one", () => {
    expect(deskTime("2026-09-24T14:05:00Z")).toMatch(/^2026\.09\.\d\d \d\d:\d\d$/);
    expect(deskTime(undefined)).toBe("—");
    expect(deskTime("not a date")).toBe("—");
  });
});
