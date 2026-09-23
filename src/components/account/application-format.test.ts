import { describe, expect, it } from "vitest";

import {
  displayApplicationDate,
  erpRequestNumber,
  formatApplicationDate,
  postingHref,
  salaryText,
  statusLabel,
  statusTone,
  syncState,
  PUSH_ATTEMPTS,
} from "./application-format";
import { MAX_ATTEMPTS } from "@/server/applicant/erp-model";

describe("formatApplicationDate", () => {
  it("normalises ISO, dotted and timestamp input", () => {
    expect(formatApplicationDate("2026-10-01")).toBe("2026.10.01");
    expect(formatApplicationDate("2026.10.01")).toBe("2026.10.01");
    expect(formatApplicationDate("2026-1-5")).toBe("2026.01.05");
    expect(formatApplicationDate("2026-10-01T23:30:00Z")).toBe("2026.10.01");
  });
  it("returns null for missing or unparseable values", () => {
    for (const v of [undefined, null, "", "  ", "abc", 20261001, "2026-13-01", "2026-00-10"]) {
      expect(formatApplicationDate(v)).toBeNull();
    }
  });
});

describe("statusTone", () => {
  it("is neutral by default", () => {
    expect(statusTone(undefined)).toBe("neutral");
    expect(statusTone("")).toBe("neutral");
    expect(statusTone("Тодорхойгүй шинэ төлөв")).toBe("neutral");
  });
  it("recognises known keywords", () => {
    expect(statusTone("Цуцлагдсан")).toBe("negative");
    expect(statusTone("Татгалзсан")).toBe("negative");
    expect(statusTone("Батлагдсан")).toBe("positive");
    expect(statusTone("Хүлээгдэж буй")).toBe("pending");
  });
  it("never reads a negated form as positive", () => {
    expect(statusTone("Батлагдаагүй")).toBe("neutral");
  });
});

describe("statusLabel", () => {
  it("falls back to the existing wording", () => {
    expect(statusLabel(undefined)).toBe("Хүлээгдэж буй");
    expect(statusLabel("  ")).toBe("Хүлээгдэж буй");
    expect(statusLabel(" Батлагдсан ")).toBe("Батлагдсан");
  });
});

describe("salaryText", () => {
  it("marks absence", () => {
    expect(salaryText(undefined)).toEqual({ text: "Цалингийн түвшин сонгоогүй", chosen: false });
    expect(salaryText("1-2 сая")).toEqual({ text: "1-2 сая", chosen: true });
  });
});

describe("displayApplicationDate", () => {
  it("normalises recognised dates", () => {
    expect(displayApplicationDate("2026-10-01")).toBe("2026.10.01");
  });
  it("falls back to the raw text for unrecognised formats instead of dropping it", () => {
    expect(displayApplicationDate(" 01/10/2026 ")).toBe("01/10/2026");
  });
  it("is null only when there is nothing to show", () => {
    for (const v of [undefined, null, "", "   ", 20261001]) {
      expect(displayApplicationDate(v)).toBeNull();
    }
  });
});

describe("statusTone ordering", () => {
  it("never reads a waiting status as a final outcome", () => {
    expect(statusTone("Батлагдахыг хүлээж байна")).toBe("pending");
    expect(statusTone("Хүлээн авсан")).toBe("pending");
  });
  it("never colours a negated status as an outcome", () => {
    expect(statusTone("Цуцлагдаагүй")).toBe("neutral");
    expect(statusTone("Татгалзаагүй")).toBe("neutral");
    expect(statusTone("Батлагдаагүй")).toBe("neutral");
  });
  it("still recognises final outcomes", () => {
    expect(statusTone("Цуцлагдсан")).toBe("negative");
    expect(statusTone("Батлагдсан")).toBe("positive");
  });
});

describe("erpRequestNumber", () => {
  it("is the ERP's id: learnt by the push, or the row's own when it came from the ERP", () => {
    expect(erpRequestNumber({ entryid: 1_000_000_004, erp: { status: "sent", erpEntryId: 512 } })).toBe(512);
    expect(erpRequestNumber({ entryid: 511, erp: { status: "sent" } })).toBe(511);
  });
  it("is null while only this site has the row", () => {
    expect(erpRequestNumber({ entryid: 1_000_000_004, erp: { status: "pending" } })).toBeNull();
    expect(erpRequestNumber({})).toBeNull();
  });
});

describe("syncState", () => {
  it("names each push state in Mongolian, and never says the application was lost", () => {
    expect(syncState({ erp: { status: "pending" } })).toEqual({
      tone: "pending",
      label: "Хадгалагдсан — ERP-д илгээгдэж байна",
    });
    expect(syncState({ erp: { status: "sent" } })).toEqual({ tone: "positive", label: "Илгээгдсэн" });
    // Still being retried: pending tone, and the word "хадгалагдсан" stays,
    // because the row is durable here whatever the ERP is doing.
    expect(syncState({ erp: { status: "failed", attempts: 1 } })).toEqual({
      tone: "pending",
      label: "Хадгалагдсан — дахин илгээхийг оролдож байна",
    });
  });
  it("terminal rows ask for attention; retried ones do not", () => {
    const capped = syncState({ erp: { status: "failed", attempts: PUSH_ATTEMPTS, error: "erp_unavailable" } });
    expect(capped).toMatchObject({ tone: "negative", label: "Анхаарал шаардлагатай" });
    expect(capped?.hint).toBeTruthy();

    // The flag the server writes is enough on its own — one attempt, refused.
    const refused = syncState({ erp: { status: "failed", attempts: 1, error: "erp_apply_rejected", terminal: true } });
    expect(refused).toMatchObject({ tone: "negative", label: "Анхаарал шаардлагатай" });
    expect(refused?.hint).toContain("хүлээж авсангүй");

    expect(syncState({ erp: { status: "failed", attempts: 2, error: "erp_unavailable" } })?.tone).toBe("pending");
    expect(PUSH_ATTEMPTS).toBe(MAX_ATTEMPTS);
  });
  it("no classified reason ever carries an upstream message to the applicant", () => {
    const state = syncState({
      erp: { status: "failed", attempts: 5, error: "erp_apply_rejected", terminal: true },
    });
    expect(`${state?.label} ${state?.hint}`).not.toMatch(/ORA-|http_|retmsg/);
  });
  it("waiting on the profile or on a cancel is not a failure", () => {
    expect(syncState({ erp: { status: "failed", attempts: 5, error: "profile_incomplete" } })).toEqual({
      tone: "pending",
      label: "Хувийн мэдээллээ бөглөсний дараа илгээгдэнэ",
    });
    expect(syncState({ erp: { status: "failed", attempts: 1, error: "erp_withdraw_pending" } })?.tone).toBe("pending");
  });
  it("shows nothing without an ERP (mock mode)", () => {
    expect(syncState({ erp: { status: "skipped" } })).toBeNull();
    expect(syncState({})).toBeNull();
  });
});

describe("postingHref", () => {
  it("links the posting when its id is known", () => {
    expect(postingHref({ recruitmentorderid: 786 })).toBe("/careers/786");
    expect(postingHref({ recruitmentorderid: "786" })).toBe("/careers/786");
    expect(postingHref({})).toBeNull();
    expect(postingHref({ recruitmentorderid: 0 })).toBeNull();
  });
});
