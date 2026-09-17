// @vitest-environment jsdom

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AsyncCombobox } from "./async-combobox";
import type { DropdownOption, DropdownQuery } from "@/lib/api";

/**
 * What the box shows when it is focused.
 *
 * The first cut blanked it: the input rendered `isOpen ? typed : label` and
 * `typed` started empty, so tabbing into a finished form emptied every answer
 * on screen — the value survived, but nobody could tell — and the list that
 * opened was the unfiltered one rather than the one the current choice came
 * from. The APG editable-combobox pattern keeps the value and selects its
 * text instead, which is also what makes the first keystroke replace it.
 *
 * Driven through `react-dom/client` directly: there is no testing library in
 * this repo and the brief rules out adding one, and the behaviour only exists
 * once focus, the debounce and the `ids` lookup are all running together.
 */

const ROWS: DropdownOption[] = [
  { value: "1", label: "Монгол Улсын Их Сургууль", raw: { key: 1, text: "Монгол Улсын Их Сургууль" } },
  { value: "67", label: "МУИС-МХСС", raw: { key: 67, text: "МУИС-МХСС" } },
  { value: "68", label: "МУИС-ГХСС", raw: { key: 68, text: "МУИС-ГХСС" } },
];

/** Stands in for `reference.universities`, honouring `search` and `ids`. */
function fakeEndpoint() {
  const calls: DropdownQuery[] = [];
  const load = async (query: DropdownQuery) => {
    calls.push(query);
    const search = String(query.search ?? "").toLowerCase();
    return search ? ROWS.filter((row) => row.label.toLowerCase().includes(search)) : ROWS;
  };
  const resolve = async (id: string) => ROWS.find((row) => row.value === id) ?? null;
  return { calls, load, resolve };
}

function Harness(props: {
  load: (query: DropdownQuery) => Promise<DropdownOption[]>;
  resolve?: (id: string) => Promise<DropdownOption | null>;
  saved: string;
}) {
  const [value, setValue] = React.useState(props.saved);
  return React.createElement(AsyncCombobox, {
    id: "universityid",
    value,
    onChange: (next: string) => setValue(next),
    load: props.load,
    resolve: props.resolve,
  });
}

let container: HTMLDivElement;
let root: Root;
let selectSpy: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom ships none of these three; the component uses them to keep the
  // active row in view, to select the text it just put back, and to time that
  // selection for after the render that put it there.
  Element.prototype.scrollIntoView =
    vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof globalThis.requestAnimationFrame;
  selectSpy = vi.fn<() => void>();
  HTMLInputElement.prototype.select = selectSpy;

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await React.act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

/** Lets the loader's promises settle and React commit what came back. */
async function settle() {
  await React.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const input = () => container.querySelector("input") as HTMLInputElement;
const optionRows = () => [...container.querySelectorAll('[role="option"]')];

async function mount(props: Parameters<typeof Harness>[0]) {
  await React.act(async () => {
    root.render(React.createElement(Harness, props));
  });
  await settle();
}

describe("a saved value", () => {
  it("shows its label before the box is ever opened", async () => {
    const api = fakeEndpoint();
    await mount({ load: api.load, resolve: api.resolve, saved: "67" });

    expect(input().value).toBe("МУИС-МХСС");
    // The label came from the id lookup, not from a list nobody asked for.
    expect(api.calls).toHaveLength(0);
  });

  it("keeps its label on the screen when the box is focused", async () => {
    const api = fakeEndpoint();
    await mount({ load: api.load, resolve: api.resolve, saved: "67" });

    await React.act(async () => {
      input().focus();
    });
    await settle();

    expect(input().value).toBe("МУИС-МХСС");
    expect(input().getAttribute("aria-expanded")).toBe("true");
  });

  it("selects the text, so the first keystroke still replaces it", async () => {
    const api = fakeEndpoint();
    await mount({ load: api.load, resolve: api.resolve, saved: "67" });

    await React.act(async () => {
      input().focus();
    });

    expect(selectSpy).toHaveBeenCalled();
  });

  it("opens the list around the current choice rather than unfiltered", async () => {
    const api = fakeEndpoint();
    await mount({ load: api.load, resolve: api.resolve, saved: "67" });

    await React.act(async () => {
      input().focus();
    });
    await settle();

    expect(api.calls.at(-1)).toEqual({ search: "МУИС-МХСС" });
    expect(optionRows().map((row) => row.textContent)).toEqual(["МУИС-МХСС"]);
  });

  it("points aria-activedescendant at the current choice", async () => {
    const api = fakeEndpoint();
    // No `resolve`, so the list itself is what labels the value — the path the
    // three search-only endpoints take.
    await mount({ load: api.load, saved: "68" });

    await React.act(async () => {
      input().focus();
    });
    await settle();

    const active = optionRows().findIndex((row) => row.getAttribute("aria-selected") === "true");
    expect(active).toBeGreaterThanOrEqual(0);
    expect(input().getAttribute("aria-activedescendant")).toBe(
      `universityid-option-${active}`,
    );
    expect(optionRows()[active].textContent).toBe("МУИС-ГХСС");
  });
});

describe("an empty value", () => {
  it("opens on the whole list", async () => {
    const api = fakeEndpoint();
    await mount({ load: api.load, resolve: api.resolve, saved: "" });

    await React.act(async () => {
      input().focus();
    });
    await settle();

    expect(api.calls.at(-1)).toEqual({ search: "" });
    expect(optionRows()).toHaveLength(ROWS.length);
    expect(input().value).toBe("");
  });

  it("asks for no label, having no id to ask about", async () => {
    const api = fakeEndpoint();
    const resolve = vi.fn(api.resolve);
    await mount({ load: api.load, resolve, saved: "" });

    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("clearing", () => {
  it("does not put the cleared label back when focus returns to the input", async () => {
    const api = fakeEndpoint();
    await mount({ load: api.load, resolve: api.resolve, saved: "67" });

    const clearButton = container.querySelector(
      'button[aria-label="Сонголтыг арилгах"]',
    ) as HTMLButtonElement;
    expect(clearButton).not.toBeNull();

    await React.act(async () => {
      clearButton.click();
    });
    await settle();

    expect(input().value).toBe("");
  });
});
