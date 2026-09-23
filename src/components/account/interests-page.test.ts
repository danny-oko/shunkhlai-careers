// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DropdownOption } from "@/lib/api";

/**
 * The Сонирхож буй ажлын байр page, driven end to end: the real page, Select
 * and AsyncCombobox, with `applications` and the two dropdowns answering the
 * way the live ERP does (2026-09-23): getPosGroupDropdown / getPositionsDropdown
 * take `search` only, position rows carry `posgroupid` (a number) and `depid`
 * (text), labels keep their "/NN/ " code (the options strip it, as
 * `toOption` does), and getInterestedJobsList rows are ids only.
 *
 * Same harness as `family-form.test.ts`.
 */

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  saves: [] as Array<Record<string, unknown>>,
  positionQueries: [] as Array<Record<string, unknown>>,
}));

const option = (key: number, text: string, extra: Record<string, unknown> = {}): DropdownOption => ({
  value: String(key),
  label: text.replace(/^\s*\/\s*\d[\d-]*\s*\/\s*/u, "").trim(),
  raw: { key, text, ...extra },
});

const GROUPS = [option(47, "/16/ Инженер, техник"), option(45, "/04/ Агуулах, тээвэр түгээлт")];
const POSITIONS = [
  option(12384, "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер", { depid: "100868", posgroupid: 47 }),
  option(11913, "/010/ Авто засварчин", { depid: "100808", posgroupid: 47 }),
  option(12722, "/171/ Жолооч", { depid: "100950", posgroupid: 45 }),
];

vi.mock("@/lib/api", async () => {
  const { stripCode } = await vi.importActual<typeof import("@/lib/api/core/factories")>("@/lib/api/core/factories");
  return {
    applications: {
      listInterests: async () => state.rows,
      saveInterest: async (body: Record<string, unknown>) => {
        state.saves.push(body);
        return true;
      },
      deleteInterest: async () => true,
    },
    reference: {
      positionGroups: async () => GROUPS,
      positions: async (query: Record<string, unknown>) => {
        state.positionQueries.push(query);
        return POSITIONS;
      },
    },
    stripCode,
    toApiError: (error: unknown) => ({ message: String(error) }),
  };
});
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import InterestsPage from "@/app/account/interests/page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.rows = [];
  state.saves = [];
  state.positionQueries = [];
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
  act(() => root.render(React.createElement(InterestsPage)));
  await settle();
}

async function click(element: Element) {
  act(() => {
    (element as HTMLElement).click();
  });
  await settle();
}

const buttonsNamed = (name: string) =>
  [...container.querySelectorAll("button")].filter(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name,
  );
const buttonNamed = (name: string) => buttonsNamed(name)[0]!;

const byId = (id: string) => document.getElementById(id);
const shown = (id: string) => byId(id)!.textContent?.trim();
const typedIn = (id: string) => (byId(id) as HTMLInputElement).value;

async function choose(id: string, value: string) {
  const select = byId(id)!.parentElement!.querySelector("select")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select, value === "" ? "__empty__" : value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

/** Opens the position box and reads what it offers. */
async function offered() {
  const input = byId("position") as HTMLInputElement;
  // A pick leaves the focus in the box, closed: step out and back in to reopen it.
  act(() => {
    input.blur();
    document.body.focus();
  });
  await settle();
  act(() => {
    input.focus();
  });
  await settle();
  return [...document.querySelectorAll('[role="option"]')].map((li) => li.textContent?.trim());
}

async function pick(label: string) {
  await offered();
  const row = [...document.querySelectorAll('[role="option"]')].find((li) => li.textContent?.trim() === label)!;
  act(() => {
    row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  });
  await settle();
}

async function submit() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

const listed = () => [...container.querySelectorAll("li p")].map((p) => p.textContent);

describe("interests: the position list follows the group", () => {
  it("nothing is asked before a group; the positions are the chosen group's, codes stripped", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    expect((byId("position") as HTMLInputElement).disabled).toBe(true);
    expect(state.positionQueries).toEqual([]);

    await choose("posgroup", "47");
    expect(await offered()).toEqual(["Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер", "Авто засварчин"]);
    // Search-only: never an `ids` (an empty one is an HTTP 400 on the ERP).
    expect(state.positionQueries.every((query) => !("ids" in query))).toBe(true);
  });

  it("a new group empties the chosen position and re-filters the list", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await choose("posgroup", "47");
    await pick("Авто засварчин");
    expect(typedIn("position")).toBe("Авто засварчин");

    await choose("posgroup", "45");
    expect(typedIn("position")).toBe("");
    expect(await offered()).toEqual(["Жолооч"]);

    // Nothing of the old choice reaches the save.
    await submit();
    expect(state.saves).toEqual([{ entryid: 0, posgroupid: 45, positionid: null, depid: null }]);
  });
});

describe("interests: saving", () => {
  it("the group is asked for", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await submit();
    expect(state.saves).toEqual([]);
    expect(container.textContent).toContain("Албан тушаалын бүлгээ сонгоно уу.");
  });

  it("a group alone is an interest: positionid and depid null (the Postman example)", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await choose("posgroup", "47");
    await submit();
    expect(state.saves).toEqual([{ entryid: 0, posgroupid: 47, positionid: null, depid: null }]);
  });

  it("a position sends its own row's depid, as the text the dropdown gives", async () => {
    await render();
    await click(buttonNamed("Нэмэх"));
    await choose("posgroup", "47");
    await pick("Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер");
    await submit();
    expect(state.saves).toEqual([{ entryid: 0, posgroupid: 47, positionid: 12384, depid: "100868" }]);
  });

  it("the same group + position again is refused before anything is sent", async () => {
    state.rows = [
      { entryid: 5, posgroupid: 47, positionid: null, depid: null },
      { entryid: 6, posgroupid: "47", positionid: 11913, depid: "100808" },
    ];
    await render();
    await click(buttonNamed("Нэмэх"));
    await choose("posgroup", "47");
    await submit();
    expect(container.textContent).toContain("Энэ ажлын байрыг аль хэдийн бүртгүүлсэн байна.");

    await pick("Авто засварчин");
    await submit();
    expect(state.saves).toEqual([]);

    await pick("Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер");
    await submit();
    expect(state.saves).toEqual([{ entryid: 0, posgroupid: 47, positionid: 12384, depid: "100868" }]);
  });
});

describe("interests: the list", () => {
  it("names rows that came with ids only (group from the group list) and strips the codes of labelled ones", async () => {
    state.rows = [
      { entryid: 5, posgroupid: 45, positionid: null, depid: null },
      {
        entryid: 6,
        posgroupid: 47,
        positionid: 12384,
        depid: "100868",
        posgroupname: "/16/ Инженер, техник",
        positionname: "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер",
      },
    ];
    await render();
    expect(listed()).toEqual([
      "Агуулах, тээвэр түгээлт",
      "Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер",
      "Инженер, техник",
    ]);
    expect(container.textContent).not.toContain("Ажлын байр​");
    expect(listed()).not.toContain("Ажлын байр");
  });

  it("Засах opens the row with its group and position; the save is an edit that keeps its depid", async () => {
    state.rows = [
      {
        entryid: 6,
        posgroupid: 47,
        positionid: 12384,
        depid: "100868",
        posgroupname: "/16/ Инженер, техник",
        positionname: "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер",
      },
    ];
    await render();
    await click(buttonNamed("Засах"));
    expect(shown("posgroup")).toBe("Инженер, техник");
    expect(typedIn("position")).toBe("Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер");

    // Its own pair is not a duplicate of itself.
    await submit();
    expect(state.saves).toEqual([{ entryid: 6, posgroupid: 47, positionid: 12384, depid: "100868" }]);
  });

  it("an edit to another position takes that row's depid", async () => {
    state.rows = [{ entryid: 6, posgroupid: 47, positionid: 12384, depid: "100868" }];
    await render();
    await click(buttonNamed("Засах"));
    // Pulled with no label: the name is found in the list.
    expect(typedIn("position")).toBe("Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер");
    await pick("Авто засварчин");
    await submit();
    expect(state.saves).toEqual([{ entryid: 6, posgroupid: 47, positionid: 11913, depid: "100808" }]);
  });
});
