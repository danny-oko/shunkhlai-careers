import { describe, expect, it } from "vitest";

import { stripCode } from "./factories";

/** Label shapes taken from the live position list (744 rows, 171 hyphenated). */
describe("stripCode", () => {
  it.each([
    ["/03/ Name", "Name"],
    ["/10406/ Business Development Specialist", "Business Development Specialist"],
    ["/02-007/ Менежер", "Менежер"],
    ["/100-17/ Санхүүгийн шинжээч", "Санхүүгийн шинжээч"],
    ["  / 02-007 /  Менежер ", "Менежер"],
  ])("%s -> %s", (input, expected) => {
    expect(stripCode(input)).toBe(expected);
  });

  it("leaves labels without a leading code alone", () => {
    expect(stripCode("Менежер /02-007/")).toBe("Менежер /02-007/");
    expect(stripCode("Leipzig")).toBe("Leipzig");
  });

  it("copes with a missing label", () => {
    expect(stripCode(null)).toBe("");
    expect(stripCode(undefined)).toBe("");
  });
});
