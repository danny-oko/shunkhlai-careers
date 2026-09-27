import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT_DEFAULTS } from "@/lib/content/defaults";

/**
 * The save action, at its two edges.
 *
 * The first is the guard. A server action is a POST to an endpoint whose id
 * the browser knows, so `requireAdmin()` inside the action is the only thing
 * standing between an anonymous request and the company's front page — the
 * proxy only turns away *navigations*. The tests below prove it runs first:
 * before the parse, before the write, and for a request that would otherwise
 * have been perfectly valid.
 *
 * The second is the refusal. Nothing half-parsed may be written, so a document
 * that fails its schema must leave `site_content` untouched.
 *
 * The store is mocked: this is about the action's order of operations, and
 * nothing here may reach a database.
 */

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => undefined) }));
const store = vi.hoisted(() => ({ writeSection: vi.fn(async () => undefined) }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/admin/guard", () => guard);
vi.mock("@/server/content/store", () => store);
vi.mock("next/cache", () => cache);

const { saveSectionAction } = await import("./actions");

/** What the `about_stats` form posts when it is filled in correctly. */
function statsForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    section: "about_stats",
    heading: "Хөгжил тоон үзүүлэлтээр · 2027",
    "items.0.value": "11,000",
    "items.0.label": "сургалтын хамрагдалт",
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  guard.requireAdmin.mockReset().mockResolvedValue(undefined);
  store.writeSection.mockReset().mockResolvedValue(undefined);
  cache.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the admin guard runs on every save", () => {
  it("is checked before anything else happens", async () => {
    await saveSectionAction({}, statsForm());
    expect(guard.requireAdmin).toHaveBeenCalledOnce();
    expect(guard.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      store.writeSection.mock.invocationCallOrder[0],
    );
  });

  it("writes nothing when the guard refuses, valid document or not", async () => {
    // `requireAdmin` redirects, which in a server action throws.
    guard.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /admin/login"));

    await expect(saveSectionAction({}, statsForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(store.writeSection).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("is checked even for a section name that does not exist", async () => {
    const data = statsForm({ section: "payroll" });
    const state = await saveSectionAction({}, data);

    expect(guard.requireAdmin).toHaveBeenCalledOnce();
    expect(state.message).toBeTruthy();
    expect(store.writeSection).not.toHaveBeenCalled();
  });
});

describe("a valid save", () => {
  it("writes the parsed document, not the raw fields", async () => {
    const state = await saveSectionAction({}, statsForm());

    expect(state.ok).toBe(true);
    expect(state.section).toBe("about_stats");
    expect(store.writeSection).toHaveBeenCalledWith(
      "about_stats",
      {
        heading: "Хөгжил тоон үзүүлэлтээр · 2027",
        items: [{ value: "11,000", label: "сургалтын хамрагдалт" }],
      },
      null,
    );
  });

  it("revalidates the page the section is on, and the desk", async () => {
    await saveSectionAction({}, statsForm());
    expect(cache.revalidatePath).toHaveBeenCalledWith("/about", "page");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/content", "layout");
  });

  it("revalidates the footer as a layout, because it is on every page", async () => {
    const data = new FormData();
    data.set("section", "footer");
    data.set("address", CONTENT_DEFAULTS.footer.address);
    data.set("addressUrl", "");

    const state = await saveSectionAction({}, data);

    expect(state.ok).toBe(true);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("a refused save", () => {
  it("writes nothing and names the fields that were wrong", async () => {
    const state = await saveSectionAction({}, statsForm({ "items.0.label": "" }));

    expect(state.ok).toBeUndefined();
    expect(state.section).toBe("about_stats");
    expect(state.fieldErrors?.["items.0.label"]).toBeTruthy();
    expect(store.writeSection).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a hero whose image is a script URL", async () => {
    const data = new FormData();
    for (const [name, value] of Object.entries({
      section: "hero",
      heading: "Гарчиг",
      "slides.0.src": "javascript:alert(1)",
      "slides.0.caption": "Тайлбар",
      "slides.0.alt": "Тайлбар",
      "primaryCta.label": "ажлын байр",
      "primaryCta.href": "/careers",
      "secondaryCta.label": "Бидний тухай",
      "secondaryCta.href": "/about",
    })) {
      data.set(name, value);
    }

    const state = await saveSectionAction({}, data);
    expect(state.fieldErrors?.["slides.0.src"]).toBeTruthy();
    expect(store.writeSection).not.toHaveBeenCalled();
  });

  it("turns a database failure into a message, never a crash", async () => {
    store.writeSection.mockRejectedValue(new Error("connection refused"));

    const state = await saveSectionAction({}, statsForm());

    expect(state.ok).toBeUndefined();
    expect(state.message).toBeTruthy();
    // Nothing was written, so nothing is revalidated.
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
