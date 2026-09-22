// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DropdownOption, DropdownQuery } from "@/lib/api";

/**
 * The Боловсрол form, driven end to end: the real page, SectionManager,
 * Select and AsyncCombobox, with the reference endpoints faked the way the
 * live ERP answers (verified 2026-09-22: getCountryID → 28;
 * GetUniversityDropDown under countryid 28 → Mongolian schools, 0 → every school).
 *
 * Same harness as `profile-form.test.ts`: `react-dom/client` directly, and a
 * select choice made through the native `<select>` Radix keeps in a form.
 */

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ list: string; query?: Record<string, unknown> }>,
  saved: [] as unknown[],
  /** Holds GetCountryDropDown back until released (null: answers at once). */
  countriesGate: null as Promise<void> | null,
}));

const rows = (list: Array<[number, string]>): DropdownOption[] =>
  list.map(([key, text]) => ({ value: String(key), label: text, raw: { key, text } }));

const DIVISIONS: Record<number, Array<[number, string]>> = {
  28: [[1, "Улаанбаатар"], [13, "Архангай"]],
  3: [[70, "Барнаул"]],
};
const UNIVERSITIES: Record<number, Array<[number, string]>> = {
  28: [[68, "МУИС-ГХСС"], [67, "МУИС-МХСС"]],
  3: [[500, "Алтайн их сургууль"]],
};
UNIVERSITIES[0] = [...UNIVERSITIES[28], ...UNIVERSITIES[3]];

vi.mock("@/lib/api", () => {
  const list = (name: string, answer: () => DropdownOption[]) => async (query?: Record<string, unknown>) => {
    state.calls.push({ list: name, query });
    return answer();
  };
  const section = (listKey: string) => ({
    list: async () => (listKey === "education" ? state.rows : []),
    save: async (body: unknown) => {
      state.saved.push(body);
      return true;
    },
    remove: async () => true,
  });
  return {
    reference: {
      countries: async () => {
        state.calls.push({ list: "countries" });
        await state.countriesGate;
        return rows([[28, "Монгол"], [3, "Орос"]]);
      },
      divisions: async (query: { countryid: number }) => {
        state.calls.push({ list: "divisions", query });
        return rows(DIVISIONS[query.countryid] ?? []);
      },
      universities: async (query: DropdownQuery & { countryid: number }) => {
        state.calls.push({ list: "universities", query });
        return rows(UNIVERSITIES[query.countryid] ?? []);
      },
      professions: list("professions", () => rows([[2414, "AI Инженер"]])),
      educationLevels: list("educationLevels", () => rows([[2010, "Бакалавр"], [2011, "Магистр"]])),
      foreignLanguages: list("foreignLanguages", () => []),
      languageLevels: list("languageLevels", () => []),
      computerSkills: list("computerSkills", () => []),
      computerSkillLevels: list("computerSkillLevels", () => []),
      defaultCountry: async () => ({ countryid: 28, countryname: "Монгол" }),
    },
    sections: {
      education: section("education"),
      language: section("language"),
      computerSkill: section("computerSkill"),
    },
    toApiError: (error: unknown) => ({ message: String(error) }),
  };
});
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import EducationPage from "@/app/account/education/page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.rows = [];
  state.calls = [];
  state.saved = [];
  state.countriesGate = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  Element.prototype.scrollIntoView = () => {};
  // Radix Switch measures its thumb; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render() {
  act(() => root.render(React.createElement(EducationPage)));
  await settle();
}

/** The first section on the page is Боловсрол. */
const education = () => container.querySelector("section")!;

async function click(element: Element) {
  act(() => {
    (element as HTMLElement).click();
  });
  await settle();
}

const buttonNamed = (name: string) =>
  [...education().querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name,
  )!;

/** What a select shows (its label, or the placeholder). */
const shown = (id: string) => document.getElementById(id)!.textContent?.trim();
/** What a combobox shows. */
const typedIn = (id: string) => (document.getElementById(id) as HTMLInputElement).value;

async function choose(id: string, value: string) {
  const select = document.getElementById(id)!.parentElement!.querySelector("select")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select, value === "" ? "__empty__" : value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

async function type(id: string, text: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

/** Opens the university combobox and picks the row labelled `label`. */
async function pickUniversity(label: string) {
  const input = document.getElementById("field-universityid") as HTMLInputElement;
  act(() => {
    input.focus();
  });
  await settle();
  const option = [...document.querySelectorAll('[role="option"]')].find(
    (li) => li.textContent?.trim() === label,
  )!;
  act(() => {
    option.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  });
  await settle();
}

async function submit() {
  await act(async () => {
    education()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

const callsOf = (list: string) => state.calls.filter((c) => c.list === list).map((c) => c.query);

const SAVED = {
  entryid: 11,
  countryid: 3,
  divisionid: 70,
  universityid: 500,
  professionid: 2414,
  educationlevelid: 2011,
  fromdate: "2018-09-01",
  todate: "2022-06-01",
};

describe("education form: Улс → Хот, аймаг + Сургууль", () => {
  it("a new row starts on the home country, its divisions and its universities", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    expect(shown("field-countryid")).toBe("Монгол");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }]);
    await pickUniversity("МУИС-ГХСС");
    expect(callsOf("universities")).toEqual([{ search: "", countryid: 28 }]);
    expect(typedIn("field-universityid")).toBe("МУИС-ГХСС");
  });

  it("the home-country seed survives the country list answering late", async () => {
    let release = () => {};
    state.countriesGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await render();
    await click(buttonNamed("Нэмэх"));
    await act(async () => release());
    await settle();
    expect(shown("field-countryid")).toBe("Монгол");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }]);
  });

  it("editing a saved row preselects every label under the saved country, asking by its id", async () => {
    let release = () => {};
    state.countriesGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.rows = [{ ...SAVED, universityname: "Алтайн их сургууль" }];
    await render();
    await click(buttonNamed("Засах"));
    await act(async () => release());
    await settle();
    expect(shown("field-countryid")).toBe("Орос");
    expect(shown("field-divisionid")).toBe("Барнаул");
    expect(shown("field-educationlevelid")).toBe("Магистр");
    expect(typedIn("field-universityid")).toBe("Алтайн их сургууль");
    expect(typedIn("field-professionid")).toBe("AI Инженер");
    expect(callsOf("divisions")).toEqual([{ countryid: 3 }]);
    expect(callsOf("universities")).toEqual([{ ids: ["500"], countryid: 3 }]);
    expect(callsOf("professions")).toEqual([{ ids: ["2414"] }]);
  });

  it("changing Улс empties Хот, аймаг and Сургууль and reloads both for the new country", async () => {
    state.rows = [SAVED];
    await render();
    await click(buttonNamed("Засах"));
    await choose("field-countryid", "28");
    expect(shown("field-divisionid")).toBe("- Сонгох -");
    expect(typedIn("field-universityid")).toBe("");
    expect(callsOf("divisions")).toEqual([{ countryid: 3 }, { countryid: 28 }]);
    await pickUniversity("МУИС-МХСС");
    expect(callsOf("universities").at(-1)).toEqual({ search: "", countryid: 28 });

    await submit();
    expect(state.saved).toHaveLength(1);
    const body = state.saved[0] as Record<string, unknown>;
    expect(body).toMatchObject({ entryid: 11, countryid: 28, universityid: 67 });
    expect(body).not.toHaveProperty("divisionid"); // emptied, so omitted (never null)
  });
});

describe("education form: saved values the lists cannot show", () => {
  it("an edit saved untouched keeps a division its list no longer has", async () => {
    state.rows = [{ ...SAVED, divisionid: 999 }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(state.saved[0]).toMatchObject({ countryid: 3, divisionid: 999, universityid: 500 });
  });
});

describe("education form: сургууль жагсаалтад байхгүй", () => {
  it("a school typed by hand is saved as universityid 0 + universitynametext", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await click(document.getElementById("field-universityid-manual")!);
    expect(document.getElementById("field-universityid")).toBeNull();
    await type("field-universitynametext", "Мандах академи");
    await choose("field-educationlevelid", "2010");
    await submit();
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({ universityid: 0, universitynametext: "Мандах академи" });
  });

  it("neither a listed school nor a typed one: nothing is sent", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await choose("field-educationlevelid", "2010");
    await submit();
    expect(state.saved).toHaveLength(0);
    expect(education().textContent).toContain("«Сургууль» талбарыг бөглөнө үү.");

    await click(document.getElementById("field-universityid-manual")!);
    await submit();
    expect(state.saved).toHaveLength(0);
    expect(education().textContent).toContain("«Сургууль» талбарыг бөглөнө үү.");
  });

  it("going back to the list drops the typed name", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await click(document.getElementById("field-universityid-manual")!);
    await type("field-universitynametext", "Мандах академи");
    await click(document.getElementById("field-universityid-manual")!);
    await pickUniversity("МУИС-ГХСС");
    await choose("field-educationlevelid", "2010");
    await submit();
    expect(state.saved[0]).toMatchObject({ universityid: 68, universitynametext: "" });
  });

  it("a saved typed school opens in the typed mode and is listed by its name", async () => {
    state.rows = [{ ...SAVED, universityid: 0, universitynametext: "Мандах академи" }];
    await render();
    expect(education().textContent).toContain("Мандах академи");
    await click(buttonNamed("Засах"));
    expect(document.getElementById("field-universityid")).toBeNull();
    expect((document.getElementById("field-universitynametext") as HTMLInputElement).value).toBe(
      "Мандах академи",
    );
  });
});

describe("education form: payload", () => {
  it("dates as YYYY-MM-DD, gpa as a number, isgraduated from Төгссөн огноо", async () => {
    state.rows = [{ ...SAVED, fromdate: "2018.09.01 00:00:00", gpa: "3.6" }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(state.saved[0]).toMatchObject({
      fromdate: "2018-09-01",
      todate: "2022-06-01",
      gpa: 3.6,
      isgraduated: "Y",
    });
  });

  it("no Төгссөн огноо: still studying", async () => {
    state.rows = [{ ...SAVED, todate: "" }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(state.saved[0]).toMatchObject({ isgraduated: "N" });
  });

  it("Төгссөн огноо still ahead: expected, not graduated", async () => {
    state.rows = [{ ...SAVED, todate: "2099-06-01" }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(state.saved[0]).toMatchObject({ todate: "2099-06-01", isgraduated: "N" });
  });
});
