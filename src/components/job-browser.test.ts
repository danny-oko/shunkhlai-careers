// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JobFilterData } from "@/lib/api/jobs";
import { FALLBACK_COMPANIES } from "@/lib/jobs/filters";
import type { Job } from "@/lib/jobs/types";

/** The careers browser: the company rail, and the `jobName` search box. */

const pushed: string[] = [];
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (url: string) => pushed.push(url) }),
  useSearchParams: () => search,
}));

const { JobBrowser } = await import("./job-browser");

const filterData = {
  location: [{ entryid: 1, name: "Шунхлай төв байр", divisionname: "Улаанбаатар" }],
  salarylevel: [{ key: 6, text: "2,100,000-2,500,000" }],
  smcompany: FALLBACK_COMPANIES.map((row) => ({ ...row })),
  hrposgroup: [{ posgroupid: 48, name: "/02/ Санхүү" }],
  positiontype: [
    { valuestr: 4, name: "Үндсэн" },
    { valuestr: 26, name: "Гэрээт" },
  ],
} as unknown as JobFilterData;

function job(over: Partial<Job> = {}): Job {
  return {
    id: "1",
    slug: "1-a",
    title: "Нягтлан бодогч",
    company: "Шунхлай ХХК",
    companyId: "SHUNKHLAI",
    location: "Шунхлай төв байр",
    positionGroup: "Санхүү",
    positionGroupId: 48,
    workType: "Бүтэн цагийн",
    positionType: "Үндсэн",
    positionTypeId: 4,
    statusId: 1,
    status: "",
    postedAt: "2026.09.01",
    closesAt: "2026.12.01",
    remainingDays: 30,
    isOpen: true,
    ...over,
  };
}

const jobs = [
  job({ id: "1" }),
  job({ id: "2" }),
  job({ id: "3", company: "Шунхлай ойл ХХК", companyId: "SHOIL" }),
];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no media queries; the browser only uses one, to close the
  // mobile drawer when the viewport grows.
  window.matchMedia = () =>
    ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList;
  pushed.length = 0;
  search = new URLSearchParams();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function render(rows: Job[] = jobs) {
  act(() => {
    root.render(React.createElement(JobBrowser, { jobs: rows, filterData }));
  });
}

/** The rows of one filter section, as `[label, count]`. */
function rail(title: string): Array<[string, string]> {
  const group = host.querySelector(`[role="radiogroup"][aria-label="${title}"]`)!;
  return [...group.querySelectorAll('[role="radio"]')].map((radio) => [
    radio.querySelector("span.truncate")!.textContent!,
    radio.querySelector("span.tabular-nums")?.textContent ?? "",
  ]);
}

function radios(title: string): HTMLButtonElement[] {
  const group = host.querySelector(`[role="radiogroup"][aria-label="${title}"]`)!;
  return [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
}

const searchBox = () =>
  host.querySelector<HTMLInputElement>('input[aria-label="Албан тушаалаар хайх"]')!;

function type(value: string) {
  const input = searchBox();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("company rail", () => {
  it("lists all eight companies in order, with their counts", () => {
    render();

    expect(rail("Компани")).toEqual([
      ["Бүх компани", "3"],
      ["Шунхлай ХХК", "2"],
      ["Шунхлай трейдинг ХХК", "0"],
      ["Шунхлай петролиум ХХК", "0"],
      ["Шунхлай говь ХХК", "0"],
      ["Шунхлай ойл ХХК", "1"],
      ["ЭсЖиШивээхүрэн депо ХХК", "0"],
      ["ЭсЖиХанги Гэйт ХХК", "0"],
      ["SGHOLDING", "0"],
    ]);
  });

  it("still lists all eight when nothing at all is open", () => {
    render([]);

    expect(rail("Компани").map(([label]) => label)).toHaveLength(9);
    expect(rail("Компани").slice(1).every(([, count]) => count === "0")).toBe(true);
  });

  it("leaves a company with no openings visible but unselectable", () => {
    render();

    const [, shunkhlai, trading] = radios("Компани");
    expect(shunkhlai.disabled).toBe(false);
    // 0 postings: the row states the fact, but selecting it could only ever
    // produce the empty state, so it is not a target.
    expect(trading.disabled).toBe(true);
    expect(trading.getAttribute("aria-disabled")).toBe("true");
    expect(trading.tabIndex).toBe(-1);

    act(() => trading.click());
    expect(host.textContent).not.toContain("Тохирох ажлын байр олдсонгүй");
  });

  it("filters the list by companyid when a company is chosen", () => {
    render();

    const oil = radios("Компани").find((row) => row.title === "Шунхлай ойл ХХК")!;
    act(() => oil.click());

    expect(host.querySelectorAll("li a[href^='/careers/']")).toHaveLength(1);
    expect(host.textContent).toContain("Шунхлай ойл ХХК");
  });

  it("drops the /NN/ prefix from a position group label", () => {
    render();

    expect(rail("Албан тушаалын бүлэг").map(([label]) => label)).toEqual([
      "Бүх бүлэг",
      "Санхүү",
    ]);
  });

  it("hides an empty row everywhere except Компани", () => {
    render();

    // Nothing is "Гэрээт" here, so that row is gone — while the companies
    // with nothing open are still listed above.
    expect(rail("Ажиллах хэлбэр")).toEqual([
      ["Бүх хэлбэр", "3"],
      ["Үндсэн", "3"],
    ]);
    expect(rail("Компани")).toHaveLength(9);
  });
});

describe("jobName search", () => {
  it("puts the typed text in the URL once the typing settles", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render();

    type("нягтлан");
    expect(pushed).toEqual([]);

    act(() => void vi.advanceTimersByTime(299));
    expect(pushed).toEqual([]);

    act(() => void vi.advanceTimersByTime(1));
    expect(pushed).toEqual(["/careers?jobName=%D0%BD%D1%8F%D0%B3%D1%82%D0%BB%D0%B0%D0%BD"]);
  });

  it("pushes once for a burst of keystrokes, trimmed", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render();

    type("ня");
    act(() => void vi.advanceTimersByTime(200));
    type("нягт ");
    act(() => void vi.advanceTimersByTime(400));

    expect(pushed).toHaveLength(1);
    expect(decodeURIComponent(pushed[0])).toBe("/careers?jobName=нягт");
  });

  it("keeps the other filters in the query string", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    search = new URLSearchParams({ locationid: "1" });
    render();

    type("инженер");
    act(() => void vi.advanceTimersByTime(300));

    expect(decodeURIComponent(pushed[0])).toBe("/careers?locationid=1&jobName=инженер");
  });

  it("pushes exactly once when Enter beats the debounce", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render();

    type("нягтлан");
    act(() => void vi.advanceTimersByTime(100));
    const input = searchBox();
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(pushed).toHaveLength(1);
    // The debounced push behind it must not fire a second, identical navigation.
    act(() => void vi.advanceTimersByTime(1000));
    expect(pushed).toHaveLength(1);
  });

  it("pushes exactly once when the clear button beats the debounce", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    search = new URLSearchParams({ jobName: "нягтлан" });
    render();

    type("нягтлан бодогч");
    act(() => void vi.advanceTimersByTime(100));
    const clear = host.querySelector<HTMLButtonElement>('[aria-label="Хайлтыг цэвэрлэх"]')!;
    act(() => clear.click());

    expect(pushed).toEqual(["/careers"]);
    act(() => void vi.advanceTimersByTime(1000));
    expect(pushed).toEqual(["/careers"]);
  });

  it("keeps keystrokes typed while the navigation is still in flight", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render();

    type("инж");
    act(() => void vi.advanceTimersByTime(300));
    expect(pushed).toHaveLength(1);

    // The push is slow: the URL still says "инж" when it finally lands, and
    // by then more has been typed. The extra letters must survive.
    type("инженер");
    search = new URLSearchParams({ jobName: "инж" });
    render();

    expect(searchBox().value).toBe("инженер");
    act(() => void vi.advanceTimersByTime(300));
    expect(decodeURIComponent(pushed[1])).toBe("/careers?jobName=инженер");
  });

  it("clears the search without waiting, and shows a chip meanwhile", () => {
    search = new URLSearchParams({ jobName: "нягтлан" });
    render();

    expect(searchBox().value).toBe("нягтлан");
    expect(host.querySelector('[aria-label="Идэвхтэй шүүлтүүрүүд"]')!.textContent).toContain(
      "«нягтлан»",
    );

    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Хайлтыг цэвэрлэх"]')!.click());

    expect(pushed).toEqual(["/careers"]);
    expect(searchBox().value).toBe("");
  });

  it("removing the search chip clears the box too", () => {
    search = new URLSearchParams({ jobName: "нягтлан" });
    render();

    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="«нягтлан» шүүлтүүрийг арилгах"]')!
        .click(),
    );
    expect(pushed).toEqual(["/careers"]);

    // The page comes back without the param; the box follows the URL.
    search = new URLSearchParams();
    render();
    expect(searchBox().value).toBe("");
  });
});
