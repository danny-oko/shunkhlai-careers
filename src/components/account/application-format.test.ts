import { describe, expect, it } from "vitest";

import {
  formatApplicationDate,
  salaryText,
  statusLabel,
  statusTone,
} from "./application-format";

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
