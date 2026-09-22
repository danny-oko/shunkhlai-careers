// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DropdownOption } from "@/lib/api";

/**
 * The Гэр бүлийн мэдээлэл form, driven end to end: the real page,
 * SectionManager, Select and AsyncCombobox, and the real `sections.family`
 * resource down to the transport — so what is asserted is the body
 * `SaveAppFamily` receives. The reference endpoints answer the way the live
 * ERP does (2026-09-23): Монгол is countryid 28, and GetDistrictDropDown gives
 * nothing without a province.
 *
 * Same harness as `experience-form.test.ts`.
 */

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ list: string; query?: Record<string, unknown> }>,
  posts: [] as Array<{ url: string; body: unknown }>,
}));

const rows = (list: Array<[number, string]>): DropdownOption[] =>
  list.map(([key, text]) => ({ value: String(key), label: text, raw: { key, text } }));

const DIVISIONS: Record<number, Array<[number, string]>> = {
  28: [[1, "Улаанбаатар"], [13, "Архангай"]],
  3: [[3001, "Москва"]],
};
const DISTRICTS: Record<number, Array<[number, string]>> = {
  1: [[4, "Баянгол"], [11, "Хан-Уул"]],
  13: [[130, "Цэцэрлэг"]],
  3001: [[30011, "Арбат"]],
};

vi.mock("@/lib/api/core/request", () => ({
  apiGet: async () => ({ hrappfamilylist: state.rows, hrapprelativelist: [] }),
  apiGetList: async () => [],
  apiPost: async (url: string, body: unknown) => {
    state.posts.push({ url, body });
    return true;
  },
}));

vi.mock("@/lib/api", async () => {
  const { family } = await vi.importActual<typeof import("@/lib/api/sections")>("@/lib/api/sections");
  const track = (list: string, query?: Record<string, unknown>) => state.calls.push({ list, query });
  return {
    reference: {
      defaultCountry: async () => ({ countryid: 28, countryname: "Монгол" }),
      relativeTypes: async () => {
        track("relativeTypes");
        return rows([[19, "Авга ах"], [2003, "Аав"]]);
      },
      countries: async () => {
        track("countries");
        return rows([[28, "Монгол"], [3, "Орос"]]);
      },
      divisions: async (query: { countryid: number }) => {
        track("divisions", query);
        return rows(DIVISIONS[query.countryid] ?? []);
      },
      districts: async (query: { divisionid: number }) => {
        track("districts", query);
        return rows(DISTRICTS[query.divisionid] ?? []);
      },
      professions: async (query?: Record<string, unknown>) => {
        track("professions", query);
        return rows([[5, "Зохион байгуулагч"], [1006, "Өмгөөлөгч"]]);
      },
      jobTitles: async (query?: Record<string, unknown>) => {
        track("jobTitles", query);
        return rows([[8477, "Админ менежер"], [7134, "Нягтлан бодогч"]]);
      },
    },
    sections: { family },
    toApiError: (error: unknown) => ({ message: String(error) }),
  };
});
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import FamilyPage from "@/app/account/family/page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.rows = [];
  state.calls = [];
  state.posts = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T10:00:00"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  Element.prototype.scrollIntoView = () => {};
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
  vi.useRealTimers();
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
  act(() => root.render(React.createElement(FamilyPage)));
  await settle();
}

async function click(element: Element) {
  act(() => {
    (element as HTMLElement).click();
  });
  await settle();
}

const buttonNamed = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name,
  )!;

const byId = (id: string) => document.getElementById(id);
/** What a select shows (its label, or the placeholder). */
const shown = (id: string) => byId(id)!.textContent?.trim();
const typedIn = (id: string) => (byId(id) as HTMLInputElement).value;
const disabled = (id: string) => (byId(id) as HTMLButtonElement).disabled;

async function choose(id: string, value: string) {
  const select = byId(id)!.parentElement!.querySelector("select")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select, value === "" ? "__empty__" : value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

async function type(id: string, text: string) {
  const input = byId(id) as HTMLInputElement;
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

/** Opens a combobox and picks the row labelled `label`. */
async function pick(id: string, label: string) {
  act(() => {
    (byId(id) as HTMLInputElement).focus();
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
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

const saves = () => state.posts.filter((p) => p.url.endsWith("/SaveAppFamily"));
const sentRow = () => (saves()[0].body as Array<Record<string, unknown>>)[0];
const listed = () => [...container.querySelectorAll("li p")].map((p) => p.textContent);
const callsOf = (list: string) => state.calls.filter((c) => c.list === list).map((c) => c.query);

/** A row as the ERP lists it: ids only (our labels added), datetimes. */
const FATHER = {
  entryid: 31,
  relativeid: 2003,
  relativename: "Аав",
  lastname: "Бат",
  firstname: "Дорж",
  gender: "M",
  famregno: "УБ70010101",
  birthdate: "1970-01-01T00:00:00",
  countryid: 28,
  countryname: "Монгол",
  divisionid: 1,
  divisionname: "Улаанбаатар",
  districtid: 11,
  districtname: "Хан-Уул",
  professionid: 1006,
  professionname: "Өмгөөлөгч",
  orgname: "ААН",
  jobid: 8477,
  jobname: "Админ менежер",
  phone: 99330033,
  note: "",
};

async function fillRequired() {
  await choose("field-relativeid", "2003");
  await type("field-lastname", "Бат");
  await type("field-firstname", "Дорж");
}

describe("family form: Оршин суугаа газар", () => {
  it("a new member starts in the home country; the district waits for a province", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    expect(shown("field-countryid")).toBe("Монгол");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }]);
    expect(disabled("field-districtid")).toBe(true);
    expect(shown("field-districtid")).toBe("Эхлээд «Аймаг, хот» сонгоно уу");
    expect(callsOf("districts")).toEqual([]);

    await choose("field-divisionid", "1");
    expect(callsOf("districts")).toEqual([{ divisionid: 1 }]);
    await choose("field-districtid", "11");
    expect(shown("field-districtid")).toBe("Хан-Уул");
  });

  it("a new province empties and re-reads the district", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await choose("field-divisionid", "1");
    await choose("field-districtid", "11");
    await choose("field-divisionid", "13");
    expect(shown("field-districtid")).toBe("- Сонгох -");
    expect(callsOf("districts")).toEqual([{ divisionid: 1 }, { divisionid: 13 }]);
    await choose("field-districtid", "130");
    expect(shown("field-districtid")).toBe("Цэцэрлэг");
  });

  it("a new country empties the province and the district below it", async () => {
    state.rows = [FATHER];
    await render();
    await click(buttonNamed("Засах"));
    expect(shown("field-divisionid")).toBe("Улаанбаатар");
    expect(shown("field-districtid")).toBe("Хан-Уул");

    await choose("field-countryid", "3");
    expect(shown("field-divisionid")).toBe("- Сонгох -");
    expect(shown("field-districtid")).toBe("Эхлээд «Аймаг, хот» сонгоно уу");
    expect(callsOf("divisions")).toEqual([{ countryid: 28 }, { countryid: 3 }]);

    await submit();
    expect(sentRow()).toMatchObject({ countryid: 3 });
    // Empty ids are left out, never null (section-payload.ts).
    expect(sentRow()).not.toHaveProperty("divisionid");
    expect(sentRow()).not.toHaveProperty("districtid");
  });
});

describe("family form: required fields and регистр", () => {
  it("Таны хэн болох, Овог, Нэр are asked for; nothing else is", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await submit();
    expect(saves()).toEqual([]);
    expect(container.textContent).toContain("«Таны хэн болох» талбарыг бөглөнө үү.");

    await choose("field-relativeid", "2003");
    await type("field-lastname", "Бат");
    await submit();
    expect(container.textContent).toContain("«Нэр» талбарыг бөглөнө үү.");

    await type("field-firstname", "Дорж");
    await submit();
    expect(saves()).toHaveLength(1);
  });

  it("a регистр that is not 2 letters + 8 digits is refused; an empty one is fine", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await fillRequired();
    await type("field-famregno", "УБ7001");
    await submit();
    expect(saves()).toEqual([]);
    expect(container.textContent).toContain("Регистрийн дугаар 2 кирилл үсэг, 8 цифрээс бүрдэнэ");

    await type("field-famregno", "");
    await submit();
    expect(saves()).toHaveLength(1);
    expect(sentRow()).toMatchObject({ famregno: "" });
  });

  it("a lower-case регистр is sent upper-cased", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await fillRequired();
    await type("field-famregno", " уб70010101 ");
    await submit();
    expect(sentRow()).toMatchObject({ famregno: "УБ70010101" });
  });
});

describe("family form: payload", () => {
  it("a new member is one Postman row in an array: ids as numbers, gender as the letter, empty ids left out", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await fillRequired();
    await choose("field-gender", "F");
    await choose("field-divisionid", "1");
    await choose("field-districtid", "4");
    await pick("field-professionid", "Зохион байгуулагч");
    await type("field-orgname", "Шунхлай ХХК");
    await type("field-phone", " 99112233 ");
    await type("field-note", "Тэтгэвэрт");
    await submit();

    expect(saves()).toHaveLength(1);
    const body = saves()[0].body;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(sentRow()).toEqual({
      entryid: 0,
      relativeid: 2003,
      lastname: "Бат",
      firstname: "Дорж",
      gender: "F",
      famregno: "",
      countryid: 28,
      divisionid: 1,
      districtid: 4,
      professionid: 5,
      orgname: "Шунхлай ХХК",
      phone: "99112233",
      note: "Тэтгэвэрт",
    });
    // Албан тушаал was not picked: left out, not null.
    expect(sentRow()).not.toHaveProperty("jobid");
  });

  it("an untouched edit sends the row as saved: YYYY-MM-DD, its ERP id, the phone as text", async () => {
    state.rows = [FATHER];
    await render();
    await click(buttonNamed("Засах"));
    expect(shown("field-relativeid")).toBe("Аав");
    expect(shown("field-gender")).toBe("Эрэгтэй");
    expect(typedIn("field-professionid")).toBe("Өмгөөлөгч");
    expect(typedIn("field-jobid")).toBe("Админ менежер");
    await submit();
    expect(sentRow()).toMatchObject({
      entryid: 31,
      relativeid: 2003,
      gender: "M",
      famregno: "УБ70010101",
      birthdate: "1970-01-01",
      countryid: 28,
      divisionid: 1,
      districtid: 11,
      professionid: 1006,
      orgname: "ААН",
      jobid: 8477,
      phone: "99330033",
    });
  });

  it('a cleared Хүйс goes as ""; a cleared Улс is left out, not null', async () => {
    state.rows = [FATHER];
    await render();
    await click(buttonNamed("Засах"));
    await choose("field-gender", "");
    await choose("field-countryid", "");
    await submit();
    expect(sentRow()).toMatchObject({ gender: "" });
    expect(sentRow()).not.toHaveProperty("countryid");
  });
});

describe("family form: the list", () => {
  it("shows relation · name, then birthdate (age) · org · job", async () => {
    state.rows = [FATHER, { entryid: 32, relativeid: 19, relativename: "Авга ах", firstname: "Болд" }];
    await render();
    expect(listed()).toEqual([
      "Аав · Бат Дорж",
      "1970-01-01 (56 нас) · ААН · Админ менежер",
      "Авга ах · Болд",
      "",
    ]);
  });

  it("the age counts a birthday not yet reached this year", async () => {
    state.rows = [{ ...FATHER, birthdate: "1970-12-31" }];
    await render();
    expect(listed()[1]).toContain("1970-12-31 (55 нас)");
  });
});
