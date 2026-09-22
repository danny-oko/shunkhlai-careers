// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DropdownOption } from "@/lib/api";

/**
 * The Ажлын туршлага form, driven end to end: the real page, SectionManager,
 * Select, Switch and AsyncCombobox, with the reference endpoints faked the way
 * the live ERP answers (2026-09-22): GetBusinessTypeDropDown is one row, and
 * GetJobDropDown ignores `ids` — every row comes back whatever is asked.
 *
 * Same harness as `section-manager.test.ts`.
 */

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ list: string; query?: Record<string, unknown> }>,
  saved: [] as unknown[],
}));

const rows = (list: Array<[number, string]>): DropdownOption[] =>
  list.map(([key, text]) => ({ value: String(key), label: text, raw: { key, text } }));

vi.mock("@/lib/api", () => ({
  reference: {
    businessTypes: async () => {
      state.calls.push({ list: "businessTypes" });
      return rows([[1, "Хүнс үйлдвэрлэл"]]);
    },
    jobTitles: async (query?: Record<string, unknown>) => {
      state.calls.push({ list: "jobTitles", query });
      return rows([[7134, "Агуулахын стратеги, төсөл хариуцсан менежер"], [8477, "Админ менежер"]]);
    },
  },
  sections: {
    experience: {
      list: async () => state.rows,
      save: async (body: unknown) => {
        state.saved.push(body);
        return true;
      },
      remove: async () => true,
    },
  },
  toApiError: (error: unknown) => ({ message: String(error) }),
}));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import ExperiencePage from "@/app/account/experience/page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.rows = [];
  state.calls = [];
  state.saved = [];
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
  act(() => root.render(React.createElement(ExperiencePage)));
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
const shown = (id: string) => byId(id)!.textContent?.trim();
const typedIn = (id: string) => (byId(id) as HTMLInputElement).value;
const working = () => byId("field-isworking")!.getAttribute("aria-checked");

async function type(id: string, text: string) {
  const input = byId(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

async function submit() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

const sent = () => state.saved[0] as Record<string, unknown>;
const listed = () => [...container.querySelectorAll("li p")].map((p) => p.textContent);

/** A row as the ERP lists it: datetimes, numbers where the form has text. */
const LEFT = {
  entryid: 21,
  orgname: "Шунхлай ХХК",
  businesstypeid: 1,
  businesstypename: "Хүнс үйлдвэрлэл",
  jobid: 8477,
  jobname: "Админ менежер",
  fromdate: "2022-07-01T00:00:00",
  todate: "2024-01-01T00:00:00",
  isworking: "N",
  basewage: 1500000,
  responsibility: "Гүйцэтгэсэн үүрэг",
  reason: "Хувийн шалтгаан",
  headname: "Удирдлагын нэр",
  headjobid: 7134,
  headphone: 99660066,
};

describe("experience form: Одоо ажиллаж байгаа", () => {
  it("a new row starts not working, with Ажлаас гарсан shown; the switch hides it", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    expect(working()).toBe("false");
    expect(byId("field-todate")).not.toBeNull();
    await click(byId("field-isworking")!);
    expect(working()).toBe("true");
    expect(byId("field-todate")).toBeNull();
  });

  it("switched on for a row that had left: isworking Y and the end date emptied", async () => {
    state.rows = [LEFT];
    await render();
    await click(buttonNamed("Засах"));
    expect(working()).toBe("false");
    await click(byId("field-isworking")!);
    await submit();
    expect(sent()).toMatchObject({ entryid: 21, isworking: "Y", todate: "", fromdate: "2022-07-01" });
  });

  it("a saved row with no end date opens switched on and is listed as одоог хүртэл", async () => {
    state.rows = [{ ...LEFT, todate: null, isworking: null }];
    await render();
    expect(listed()).toContain("Админ менежер · Хүнс үйлдвэрлэл · 2022-07-01 – одоог хүртэл");
    await click(buttonNamed("Засах"));
    expect(working()).toBe("true");
    expect(byId("field-todate")).toBeNull();
    await submit();
    expect(sent()).toMatchObject({ isworking: "Y", todate: "" });
  });

  it("isworking Y wins over a stale end date", async () => {
    state.rows = [{ ...LEFT, isworking: "Y" }];
    await render();
    expect(listed()).toContain("Админ менежер · Хүнс үйлдвэрлэл · 2022-07-01 – одоог хүртэл");
    await click(buttonNamed("Засах"));
    expect(working()).toBe("true");
  });

  it("switched off with no end date: Ажлаас гарсан is asked for and nothing is sent", async () => {
    state.rows = [{ ...LEFT, todate: "" }];
    await render();
    await click(buttonNamed("Засах"));
    await click(byId("field-isworking")!);
    expect(byId("field-todate")).not.toBeNull();
    await submit();
    expect(state.saved).toEqual([]);
    expect(container.textContent).toContain("«Ажлаас гарсан» талбарыг бөглөнө үү.");
  });
});

describe("experience form: payload", () => {
  it("an untouched edit sends the Postman body: YYYY-MM-DD, basewage a number, headphone text, isworking N", async () => {
    state.rows = [{ ...LEFT, basewage: "1500000" }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(sent()).toMatchObject({
      entryid: 21,
      orgname: "Шунхлай ХХК",
      businesstypeid: 1,
      jobid: 8477,
      fromdate: "2022-07-01",
      todate: "2024-01-01",
      isworking: "N",
      basewage: 1500000,
      headjobid: 7134,
      headphone: "99660066",
    });
  });

  it("an emptied basewage is left out, never null", async () => {
    state.rows = [LEFT];
    await render();
    await click(buttonNamed("Засах"));
    await type("field-basewage", "");
    await submit();
    expect(sent()).not.toHaveProperty("basewage");
  });

  it("both job titles are named from the one list though it ignores ids", async () => {
    state.rows = [LEFT];
    await render();
    await click(buttonNamed("Засах"));
    expect(typedIn("field-jobid")).toBe("Админ менежер");
    expect(typedIn("field-headjobid")).toBe("Агуулахын стратеги, төсөл хариуцсан менежер");
    expect(shown("field-businesstypeid")).toBe("Хүнс үйлдвэрлэл");
  });
});

describe("experience form: чиглэл жагсаалтад байхгүй", () => {
  it("a typed business type is sent as businesstypenametext with no businesstypeid", async () => {
    state.rows = [LEFT];
    await render();
    await click(buttonNamed("Засах"));
    await click(byId("field-businesstypeid-manual")!);
    await type("field-businesstypenametext", "Шатахуун түгээлт");
    await submit();
    expect(sent()).toMatchObject({ businesstypenametext: "Шатахуун түгээлт" });
    expect(sent()).not.toHaveProperty("businesstypeid");
  });

  it("no business type at all is fine (not required)", async () => {
    state.rows = [{ ...LEFT, businesstypeid: 0, businesstypename: "" }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(state.saved).toHaveLength(1);
    expect(sent()).not.toHaveProperty("businesstypeid");
  });

  it("a picked type drops a typed name", async () => {
    state.rows = [{ ...LEFT, businesstypenametext: "Хуучин" }];
    await render();
    await click(buttonNamed("Засах"));
    await submit();
    expect(sent()).toMatchObject({ businesstypeid: 1, businesstypenametext: "" });
  });

  it("a saved typed type is listed by its name and opens typed", async () => {
    state.rows = [{ ...LEFT, businesstypeid: 0, businesstypename: "", businesstypenametext: "Шатахуун түгээлт" }];
    await render();
    expect(listed()).toContain("Админ менежер · Шатахуун түгээлт · 2022-07-01 – 2024-01-01");
    await click(buttonNamed("Засах"));
    expect(typedIn("field-businesstypenametext")).toBe("Шатахуун түгээлт");
  });
});
