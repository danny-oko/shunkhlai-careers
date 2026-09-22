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
  languageRows: [] as Array<Record<string, unknown>>,
  skillRows: [] as Array<Record<string, unknown>>,
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
    list: async () =>
      listKey === "education"
        ? state.rows
        : listKey === "language"
          ? state.languageRows
          : listKey === "computerSkill"
            ? state.skillRows
            : [],
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
      foreignLanguages: list("foreignLanguages", () => rows([[15, "Англи"], [17, "Орос"]])),
      // GetForLanguageLevelDropDown as live answers it (2026-09-22, part).
      languageLevels: list("languageLevels", () => rows([[2, "Анхан"], [4, "Дунд"], [6, "Дээд түвшин"]])),
      // GetSkillCompDropDown / GetSkillCompLevelDropDown as live answers them
      // (2026-09-22, part): the same three levels under every skillcompid, 0 too.
      computerSkills: list("computerSkills", () => rows([[11, "Autocad"], [3, "Word"], [6, "Excel"]])),
      computerSkillLevels: list("computerSkillLevels", () =>
        rows([[2, "Бүрэн эзэмшсэн"], [4, "Анхан шатны"], [3, "Хэрэглээний түвшинд"]]),
      ),
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
  state.languageRows = [];
  state.skillRows = [];
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

describe("education form → /api/me: a real edit replaces the row", () => {
  it("columns the form never renders survive; a field emptied in the form is gone from the stored row", async () => {
    // As the list serves an ERP row: ERP-only columns and our marker beside the form's fields.
    const stored = { ...SAVED, schoolname: "МУИС", graduated: "Үгүй", certificateno: "D-77", erp: "synced" };
    state.rows = [stored];
    await render();
    await click(buttonNamed("Засах"));
    await choose("field-divisionid", ""); // emptied
    await type("field-gpa", "3.8");
    await submit();
    expect(state.saved).toHaveLength(1);

    const { handleApplicantRequest } = await import("@/server/applicant/handlers");
    const doc = { education: [{ ...stored }] } as unknown as Parameters<typeof handleApplicantRequest>[1];
    const result = await handleApplicantRequest(
      { endpoint: "SaveHrAppEducation", method: "POST", query: new URLSearchParams(), body: state.saved[0] },
      doc,
      { label: () => "", nextEntryId: () => 1_000_000_001, jobOrder: () => null },
    );
    expect(result?.envelope.rettype).toBe(0);
    expect(doc.education).toHaveLength(1);
    expect(doc.education[0]).toMatchObject({
      entryid: 11,
      schoolname: "МУИС",
      graduated: "Үгүй",
      certificateno: "D-77",
      gpa: 3.8,
      erp: "synced",
    });
    expect(doc.education[0]).not.toHaveProperty("divisionid");
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

/* --- Гадаад хэлний мэдлэг ------------------------------------------------ */

/** The second section on the page. */
const languages = () => container.querySelectorAll("section")[1] as HTMLElement;

const languageButton = (name: string) =>
  [...languages().querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name,
  )!;

async function submitLanguage() {
  await act(async () => {
    languages()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

const LEVEL_FIELDS = ["listeninglevelid", "speakinglevelid", "readinglevelid", "writinglevelid"];

const SAVED_LANGUAGE = {
  entryid: 21,
  forlanguageid: 15,
  forlanguagename: "Англи",
  studytime: 5,
  listeninglevelid: 4,
  listeninglevelname: "Дунд",
  speakinglevelid: 4,
  speakinglevelname: "Дунд",
  readinglevelid: 6,
  readinglevelname: "Дээд түвшин",
  writinglevelid: 0,
  score: "IELTS 6.5",
};

describe("language form", () => {
  it("the four level selects share one GetForLanguageLevelDropDown call", async () => {
    await render();
    await click(languageButton("Нэмэх"));
    expect(callsOf("languageLevels")).toHaveLength(1);
    expect(callsOf("foreignLanguages")).toHaveLength(1);
    for (const name of LEVEL_FIELDS) {
      const options = [...document.getElementById(`field-${name}`)!.parentElement!.querySelectorAll("option")];
      expect(options.map((o) => o.textContent)).toEqual(expect.arrayContaining(["Анхан", "Дунд", "Дээд түвшин"]));
    }
  });

  it("a new row sends the Postman body: ids and studytime as numbers, empty levels as 0, score as text", async () => {
    await render();
    await click(languageButton("Нэмэх"));
    expect(document.querySelector('label[for="field-studytime"]')?.textContent).toContain(
      "Судалсан хугацаа (жил)",
    );
    await choose("field-forlanguageid", "15");
    await type("field-studytime", "3");
    await choose("field-speakinglevelid", "4");
    await type("field-score", "7.5");
    await submitLanguage();
    expect(state.saved).toEqual([
      {
        entryid: 0,
        forlanguageid: 15,
        studytime: 3,
        listeninglevelid: 0,
        speakinglevelid: 4,
        readinglevelid: 0,
        writinglevelid: 0,
        score: "7.5",
      },
    ]);
  });

  it("no language chosen: nothing is sent", async () => {
    await render();
    await click(languageButton("Нэмэх"));
    await choose("field-speakinglevelid", "4");
    await submitLanguage();
    expect(state.saved).toEqual([]);
    expect(languages().textContent).toContain("«Гадаад хэл» талбарыг бөглөнө үү.");
  });

  it("a saved row is listed by its names and edits round-trip studytime; emptying a level sends 0", async () => {
    state.languageRows = [SAVED_LANGUAGE];
    await render();
    expect(languages().textContent).toContain("Англи");
    expect(languages().textContent).toContain(
      "Сонсох: Дунд · Ярих: Дунд · Унших: Дээд түвшин · 5 жил · IELTS 6.5",
    );

    await click(languageButton("Засах"));
    expect(shown("field-forlanguageid")).toBe("Англи");
    expect(typedIn("field-studytime")).toBe("5");
    expect(shown("field-readinglevelid")).toBe("Дээд түвшин");
    expect(shown("field-writinglevelid")).toBe("- Сонгох -"); // 0 = none
    await choose("field-listeninglevelid", "");
    await submitLanguage();
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({
      entryid: 21,
      forlanguageid: 15,
      studytime: 5,
      listeninglevelid: 0,
      speakinglevelid: 4,
      readinglevelid: 6,
      writinglevelid: 0,
      score: "IELTS 6.5",
    });
  });

  it("a score the ERP handed back as a number is sent back as text", async () => {
    state.languageRows = [{ ...SAVED_LANGUAGE, score: 7 }];
    await render();
    await click(languageButton("Засах"));
    await submitLanguage();
    expect(state.saved[0]).toMatchObject({ score: "7" });
  });
});

/* --- Компьютерийн мэдлэг ------------------------------------------------ */

/** The third section on the page. */
const skills = () => container.querySelectorAll("section")[2] as HTMLElement;

const skillButton = (name: string) =>
  [...skills().querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name,
  )!;

async function submitSkill() {
  await act(async () => {
    skills()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

const isDisabled = (id: string) => (document.getElementById(id) as HTMLButtonElement).disabled;
const optionsOf = (id: string) =>
  [...document.getElementById(id)!.parentElement!.querySelectorAll("option")].map((o) => o.textContent);

const SAVED_SKILL = {
  entryid: 43,
  skillcompid: 6,
  skillcompname: "Excel",
  levelid: 4,
  levelname: "Анхан шатны",
  compnametext: "",
  note: "Pivot",
  erp: "synced",
};

describe("computer skill form: Программ → Эзэмшсэн түвшин", () => {
  it("the level waits for a program: disabled and not fetched until one is picked", async () => {
    await render();
    await click(skillButton("Нэмэх"));
    expect(isDisabled("field-levelid")).toBe(true);
    expect(shown("field-levelid")).toBe("Эхлээд «Программ / ур чадвар» сонгоно уу");
    expect(callsOf("computerSkillLevels")).toEqual([]);

    await choose("field-skillcompid", "6");
    expect(isDisabled("field-levelid")).toBe(false);
    expect(callsOf("computerSkillLevels")).toEqual([{ skillcompid: 6 }]);
    expect(optionsOf("field-levelid")).toEqual(
      expect.arrayContaining(["Бүрэн эзэмшсэн", "Анхан шатны", "Хэрэглээний түвшинд"]),
    );
  });

  it("changing the program empties the level and reads the list again under the new one", async () => {
    await render();
    await click(skillButton("Нэмэх"));
    await choose("field-skillcompid", "6");
    await choose("field-levelid", "2");
    expect(shown("field-levelid")).toBe("Бүрэн эзэмшсэн");

    await choose("field-skillcompid", "3");
    expect(shown("field-levelid")).toBe("- Сонгох -");
    expect(callsOf("computerSkillLevels")).toEqual([{ skillcompid: 6 }, { skillcompid: 3 }]);

    await submitSkill();
    expect(state.saved).toEqual([]); // the level is заавал
    expect(skills().textContent).toContain("«Эзэмшсэн түвшин» талбарыг бөглөнө үү.");

    await choose("field-levelid", "4");
    await submitSkill();
    expect(state.saved).toEqual([{ entryid: 0, skillcompid: 3, levelid: 4, compnametext: "" }]);
  });

  it("an edit opens on the saved program and level, both named, and saves untouched as it was", async () => {
    state.skillRows = [SAVED_SKILL];
    await render();
    expect(skills().textContent).toContain("Excel");
    expect(skills().textContent).toContain("Анхан шатны · Pivot");

    await click(skillButton("Засах"));
    expect(shown("field-skillcompid")).toBe("Excel");
    expect(shown("field-levelid")).toBe("Анхан шатны");
    expect(isDisabled("field-levelid")).toBe(false);
    expect(callsOf("computerSkillLevels")).toEqual([{ skillcompid: 6 }]);

    await submitSkill();
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({ entryid: 43, skillcompid: 6, levelid: 4, note: "Pivot", compnametext: "" });
  });

  it("emptying the note on an edit leaves it empty in the body (the row is replaced, not merged)", async () => {
    state.skillRows = [SAVED_SKILL];
    await render();
    await click(skillButton("Засах"));
    const note = document.getElementById("field-note") as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setter.call(note, "");
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
    await submitSkill();
    expect(state.saved[0]).toMatchObject({ entryid: 43, note: "" });
  });
});

describe("computer skill form: программ жагсаалтад байхгүй", () => {
  it("a program typed by hand is saved as skillcompid 0 + compnametext; its level list opens once the name is in", async () => {
    await render();
    await click(skillButton("Нэмэх"));
    await click(document.getElementById("field-skillcompid-manual")!);
    expect(document.getElementById("field-skillcompid")).toBeNull();
    expect(isDisabled("field-levelid")).toBe(true);
    expect(callsOf("computerSkillLevels")).toEqual([]);

    await type("field-compnametext", "Figma");
    expect(isDisabled("field-levelid")).toBe(false);
    expect(callsOf("computerSkillLevels")).toEqual([{ skillcompid: 0 }]);
    await type("field-compnametext", "Figma Pro"); // typing on does not refetch
    expect(callsOf("computerSkillLevels")).toHaveLength(1);

    await choose("field-levelid", "3");
    await submitSkill();
    expect(state.saved).toEqual([{ entryid: 0, skillcompid: 0, compnametext: "Figma Pro", levelid: 3 }]);
  });

  it("neither a listed program nor a typed name: nothing is sent", async () => {
    await render();
    await click(skillButton("Нэмэх"));
    await submitSkill();
    expect(state.saved).toEqual([]);
    expect(skills().textContent).toContain("«Программ / ур чадвар» талбарыг бөглөнө үү.");
  });

  it("going back to the list drops the typed name and the level chosen under it", async () => {
    await render();
    await click(skillButton("Нэмэх"));
    await click(document.getElementById("field-skillcompid-manual")!);
    await type("field-compnametext", "Figma");
    await choose("field-levelid", "3");
    await click(document.getElementById("field-skillcompid-manual")!);
    expect(shown("field-skillcompid")).toBe("- Сонгох -");
    expect(shown("field-levelid")).toBe("Эхлээд «Программ / ур чадвар» сонгоно уу");
    await choose("field-skillcompid", "11");
    await choose("field-levelid", "2");
    await submitSkill();
    expect(state.saved).toEqual([{ entryid: 0, skillcompid: 11, levelid: 2, compnametext: "" }]);
  });

  it("a saved typed program is listed by its name and opens typed, its level named", async () => {
    state.skillRows = [
      { ...SAVED_SKILL, skillcompid: 0, skillcompname: "", compnametext: "Figma", levelid: 3, levelname: "Хэрэглээний түвшинд" },
    ];
    await render();
    expect(skills().querySelector("li")!.textContent).toContain("Figma");
    await click(skillButton("Засах"));
    expect(document.getElementById("field-skillcompid")).toBeNull();
    expect((document.getElementById("field-compnametext") as HTMLInputElement).value).toBe("Figma");
    expect(shown("field-levelid")).toBe("Хэрэглээний түвшинд");
    expect(callsOf("computerSkillLevels")).toEqual([{ skillcompid: 0 }]);
    await submitSkill();
    expect(state.saved[0]).toMatchObject({ entryid: 43, skillcompid: 0, compnametext: "Figma", levelid: 3 });
  });
});
