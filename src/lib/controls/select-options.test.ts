import * as React from "react";
import { describe, expect, it } from "vitest";

import { EMPTY_ITEM, fromItemValue, labelFor, parseOptions, toItemValue } from "./select-options";

const opt = (value: string | undefined, label: string, extra: object = {}) =>
  React.createElement("option", { key: label, value, ...extra }, label);

describe("sentinel", () => {
  it("maps the empty value to a non-empty item value and back", () => {
    expect(toItemValue("")).toBe(EMPTY_ITEM);
    expect(EMPTY_ITEM).not.toBe("");
    expect(fromItemValue(EMPTY_ITEM)).toBe("");
    expect(toItemValue("Y")).toBe("Y");
    expect(fromItemValue("Y")).toBe("Y");
  });
});

describe("parseOptions", () => {
  it("reads the placeholder option and the rest in order", () => {
    const { placeholder, items } = parseOptions([opt("", "- Сонгох -"), opt("1", "Нэг"), opt("2", "Хоёр")]);
    expect(placeholder).toBe("- Сонгох -");
    expect(items).toEqual([
      { value: EMPTY_ITEM, label: "- Сонгох -", disabled: undefined },
      { value: "1", label: "Нэг", disabled: undefined },
      { value: "2", label: "Хоёр", disabled: undefined },
    ]);
  });

  it("flattens mapped arrays and fragments, as call sites produce them", () => {
    const rows = [{ v: "a", l: "A" }, { v: "b", l: "B" }];
    const { items } = parseOptions([
      opt("", "pick"),
      rows.map((r) => opt(r.v, r.l)),
      React.createElement(React.Fragment, null, opt("c", "C")),
    ]);
    expect(items.map((i) => i.value)).toEqual([EMPTY_ITEM, "a", "b", "c"]);
  });

  it("has no placeholder when there is no empty option", () => {
    const { placeholder, items } = parseOptions([opt("N", "Үгүй"), opt("Y", "Тийм")]);
    expect(placeholder).toBeUndefined();
    expect(items).toHaveLength(2);
  });

  it("falls back to the text when an option has no value, and keeps disabled", () => {
    const { items } = parseOptions([opt(undefined, "Text"), opt("x", "X", { disabled: true })]);
    expect(items[0].value).toBe("Text");
    expect(items[1].disabled).toBe(true);
  });

  it("ignores non-option children", () => {
    const { items } = parseOptions([null, false, "text", React.createElement("div", { key: "d" }), opt("1", "One")]);
    expect(items).toHaveLength(1);
  });
});

describe("labelFor", () => {
  const { items } = parseOptions([opt("", "- Сонгох -"), opt("7", "Долоо")]);
  it("finds the label for a value, the empty one included", () => {
    expect(labelFor(items, "7")).toBe("Долоо");
    expect(labelFor(items, "")).toBe("- Сонгох -");
  });
  it("is empty when the value is not in the list", () => {
    expect(labelFor(items, "999")).toBe("");
  });
});
