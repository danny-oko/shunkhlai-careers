// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DropdownOption } from "@/lib/api";
import type { ApplicantProfile } from "@/lib/api/profile";

/**
 * The profile form's Улс → Аймаг, хот → Сум, дүүрэг chain and its two
 * «Таны хэн болох» selects, driven end to end: the real form, sections and
 * Select, with the reference endpoints faked the way the live ERP answers
 * (verified 2026-09-22: getCountryID → 28; the division list for country 3 →
 * Russian cities; the district list for division 13 → Архангай's sums).
 *
 * Driven through `react-dom/client` directly (no testing library here). A
 * choice is made through the native `<select>` Radix keeps beside its trigger
 * inside a form — the same `onValueChange` a click on an item reaches.
 */

const state = vi.hoisted(() => ({
  profile: null as ApplicantProfile | null,
  calls: [] as Array<{ list: string; query?: Record<string, unknown> }>,
  failDivisions: false,
  /** Holds GetCountryDropDown back until released (null: answers at once). */
  countriesGate: null as Promise<void> | null,
  saved: [] as unknown[],
}));

const rows = (list: Array<[number, string]>): DropdownOption[] =>
  list.map(([key, text]) => ({ value: String(key), label: text, raw: { key, text } }));

const DIVISIONS: Record<number, Array<[number, string]>> = {
  28: [[13, "Архангай"], [1, "Улаанбаатар"]],
  3: [[70, "Барнаул"], [34, "Камерово"]],
};
const DISTRICTS: Record<number, Array<[number, string]>> = {
  13: [[21, "Батцэнгэл"], [16, "Булган"]],
  1: [[7, "Багануур"]],
  70: [],
};

vi.mock("@/lib/api", () => ({
  reference: {
    countries: async () => {
      state.calls.push({ list: "countries" });
      await state.countriesGate;
      return rows([[28, "Монгол"], [3, "Орос"]]);
    },
    divisions: async (query: { countryid: number }) => {
      state.calls.push({ list: "divisions", query });
      if (state.failDivisions) throw new Error("down");
      return rows(DIVISIONS[query.countryid] ?? []);
    },
    districts: async (query: { divisionid: number }) => {
      state.calls.push({ list: "districts", query });
      return rows(DISTRICTS[query.divisionid] ?? []);
    },
    relativeTypes: async () => rows([[19, "Авга ах"], [11, "Ах"], [2003, "Аав"]]),
    defaultCountry: async () => ({ countryid: 28, countryname: "Монгол" }),
  },
  profile: {
    saveProfile: async (body: unknown) => {
      state.saved.push(body);
      return true;
    },
  },
  toApiError: (error: unknown) => ({ message: String(error) }),
}));
vi.mock("@/components/auth/session-provider", () => ({
  useSession: () => ({ profile: state.profile, refresh: async () => {} }),
}));
vi.mock("sonner", () => ({ toast: { success: () => {} } }));

import { ProfileForm } from "./profile-form";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.calls = [];
  state.failDivisions = false;
  state.countriesGate = null;
  state.saved = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(profile: ApplicantProfile) {
  state.profile = profile;
  act(() => root.render(React.createElement(ProfileForm)));
  await settle();
}

/** What the select shows (its label, or the placeholder). */
const shown = (id: string) => document.getElementById(id)!.textContent?.trim();
const isDisabled = (id: string) => (document.getElementById(id) as HTMLButtonElement).disabled;

/** Picks `value` ("" = the «- Сонгох -» placeholder) as the applicant would. */
async function choose(id: string, value: string) {
  const select = document.getElementById(id)!.parentElement!.querySelector("select")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select, value === "" ? "__empty__" : value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

const callsOf = (list: string) => state.calls.filter((c) => c.list === list).map((c) => c.query);

const BASE: ApplicantProfile = {
  lastname: "Дорж",
  firstname: "Бат",
  regno: "УБ99010101",
  mobilephone: "99112233",
  email2: "bat@x.mn",
  addr2: "Хаяг",
  contactname: "Дулмаа",
  contactphone: "99220022",
};

describe("profile form: location chain", () => {
  it("a saved non-home country loads its own divisions and districts, preselected with their labels", async () => {
    await render({
      ...BASE,
      countryid: 3,
      countryname: "Орос",
      divisionid: 70,
      divisionname: "Барнаул",
      relativeid: 11,
      relativename: "Ах",
      relativeid2: 2003,
      relativename2: "Аав",
    });
    expect(callsOf("divisions")).toEqual([{ countryid: 3 }]);
    expect(callsOf("districts")).toEqual([{ divisionid: 70 }]);
    expect(shown("countryid")).toBe("Орос"); // the home country (28) did not replace it
    expect(shown("divisionid")).toBe("Барнаул");
    expect(shown("districtid")).toBe("- Сонгох -");
    // Both emergency contacts read GetRelativeDropDown.
    expect(shown("relativeid")).toBe("Ах");
    expect(shown("relativeid2")).toBe("Аав");
  });

  it("changing Улс reloads Аймаг, хот for it and empties Аймаг, хот and Сум, дүүрэг", async () => {
    await render({ ...BASE, countryid: 28, divisionid: 13, districtid: 21 });
    expect(shown("divisionid")).toBe("Архангай");
    expect(shown("districtid")).toBe("Батцэнгэл");

    await choose("countryid", "3");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }, { countryid: 3 }]);
    expect(shown("countryid")).toBe("Орос");
    expect(shown("divisionid")).toBe("- Сонгох -");
    expect(shown("districtid")).toBe("- Сонгох -");
    expect(isDisabled("districtid")).toBe(true); // no province: no district list at all
    expect(callsOf("districts")).toEqual([{ divisionid: 13 }]);

    await choose("divisionid", "70");
    expect(shown("divisionid")).toBe("Барнаул");
    expect(callsOf("districts")).toEqual([{ divisionid: 13 }, { divisionid: 70 }]);
  });

  it("changing Аймаг, хот reloads Сум, дүүрэг for it and empties only Сум, дүүрэг", async () => {
    await render({ ...BASE, countryid: 28, divisionid: 13, districtid: 21 });
    await choose("divisionid", "1");
    expect(shown("countryid")).toBe("Монгол");
    expect(shown("divisionid")).toBe("Улаанбаатар");
    expect(shown("districtid")).toBe("- Сонгох -");
    expect(callsOf("districts")).toEqual([{ divisionid: 13 }, { divisionid: 1 }]);
    await choose("districtid", "7");
    expect(shown("districtid")).toBe("Багануур");
  });

  it("nothing saved: Улс is seeded from getCountryID and its divisions load", async () => {
    await render({ ...BASE });
    expect(shown("countryid")).toBe("Монгол");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }]);
    expect(isDisabled("divisionid")).toBe(false);
    expect(isDisabled("districtid")).toBe(true);
  });

  it("the seed survives getCountryID answering before the country list", async () => {
    let release = () => {};
    state.countriesGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await render({ ...BASE });
    expect(shown("countryid")).toBe("Ачаалж байна…");
    await act(async () => release());
    await settle();
    expect(shown("countryid")).toBe("Монгол");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }]);
  });

  it("a saved value its list cannot show (list failed) keeps its stored label", async () => {
    state.failDivisions = true;
    await render({ ...BASE, countryid: 28, divisionid: 13, divisionname: "Архангай", districtid: 21, districtname: "Батцэнгэл" });
    expect(shown("divisionid")).toBe("Архангай");
    expect(shown("districtid")).toBe("Батцэнгэл");
  });

  it("an emptied second contact is saved as emptied", async () => {
    await render({
      ...BASE,
      countryid: 28,
      divisionid: 13,
      districtid: 21,
      relativeid: 11,
      contactname2: "Хоёр",
      relativeid2: 19,
      contactphone2: "88887777",
    });
    await choose("relativeid2", "");
    expect(shown("relativeid2")).toBe("- Сонгох -");
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await settle();
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({ relativeid2: null, relativeid: 11, districtid: 21 });
  });
});

describe("profile form: Гэрлэлтийн байдал", () => {
  it("offers the ERP's maritalstatus[] list when the record carries it", async () => {
    await render({ ...BASE, maritalstatus: "S", maritalOptions: [{ key: "S", text: "Ганц бие" }, { key: "M", text: "Гэрлэсэн" }] });
    expect(shown("maritalstatus")).toBe("Ганц бие");
  });

  it("falls back to the built-in list", async () => {
    await render({ ...BASE, maritalstatus: "M" });
    expect(shown("maritalstatus")).toBe("Гэрлэсэн");
  });

  it("a stored code in neither list still shows (Postman's example value is \"S\")", async () => {
    await render({ ...BASE, maritalstatus: "S" });
    expect(shown("maritalstatus")).toBe("S");
  });

  it("…also when it arrives with a refreshed profile (the option and the value in one render)", async () => {
    await render({ ...BASE, maritalstatus: "M" });
    await render({ ...BASE, maritalstatus: "S" });
    expect(shown("maritalstatus")).toBe("S");
  });
});
