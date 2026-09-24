import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

import { CONTENT_DEFAULTS } from "./defaults";

/**
 * The promise this feature makes to the public pages: **they always get
 * something renderable.** An empty `site_content`, a row written by an older
 * version of the schema, and a database that is simply not answering all end
 * at the same place — the copy the component shipped with.
 *
 * It is tested against a real PostgreSQL rather than a stubbed store, because
 * two of the three failures are database failures: PGlite (Postgres compiled
 * to WASM, in this process) runs the committed migration, so the `jsonb`
 * column and its round-trip are the real ones. Nothing here reaches a network
 * or the customer's server.
 *
 * `server-only` is stubbed: it is a marker package that throws when it is
 * imported anywhere but a server component, and a unit test is neither.
 */

vi.mock("server-only", () => ({}));

const memory = vi.hoisted(() => ({
  db: null as TestDatabase | null,
  /** A statement matching this throws, as an unreachable database would. */
  failOn: null as RegExp | null,
}));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");

  memory.db = await createTestDatabase({
    onQuery: (sql) => {
      if (memory.failOn?.test(sql)) throw new Error("database unavailable");
    },
  });

  return { ...schema, getDb: () => memory.db!.db };
});

const { getContent, loadSectionsForAdmin } = await import("./service");
const { writeSection } = await import("@/server/content/store");

beforeEach(async () => {
  memory.failOn = null;
  await memory.db!.reset();
  // The console noise is the point of the code under test, not of the output.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("an empty table renders exactly what the site shipped with", () => {
  it.each(["hero", "footer", "about_stats"] as const)("%s falls back", async (key) => {
    await expect(getContent(key)).resolves.toEqual(CONTENT_DEFAULTS[key]);
  });

  it("gives the hero real pictures and a real heading, not empty strings", async () => {
    const hero = await getContent("hero");
    expect(hero.heading.length).toBeGreaterThan(0);
    expect(hero.slides.length).toBeGreaterThan(0);
    for (const slide of hero.slides) {
      expect(slide.src).not.toBe("");
      expect(slide.alt).not.toBe("");
    }
  });
});

describe("a stored section wins", () => {
  it("returns what was saved", async () => {
    await writeSection("about_stats", {
      heading: "Хөгжил тоон үзүүлэлтээр · 2027",
      items: [{ value: "11,000", label: "хамрагдалт" }],
    });

    await expect(getContent("about_stats")).resolves.toEqual({
      heading: "Хөгжил тоон үзүүлэлтээр · 2027",
      items: [{ value: "11,000", label: "хамрагдалт" }],
    });
  });

  it("does not disturb the sections nobody has saved", async () => {
    await writeSection("about_stats", CONTENT_DEFAULTS.about_stats);
    await expect(getContent("hero")).resolves.toEqual(CONTENT_DEFAULTS.hero);
  });

  it("survives a second save of the same key (upsert, not a duplicate)", async () => {
    await writeSection("footer", { ...CONTENT_DEFAULTS.footer, address: "Нэг" });
    await writeSection("footer", { ...CONTENT_DEFAULTS.footer, address: "Хоёр" });
    await expect(getContent("footer")).resolves.toMatchObject({ address: "Хоёр" });
  });
});

describe("a row that is the wrong shape is refused, not rendered", () => {
  it.each([
    ["a field is missing", { items: [{ value: "1", label: "нэг" }] }],
    ["a list is empty", { heading: "Гарчиг", items: [] }],
    ["the document is not an object", "ямар нэг мөр"],
    ["a value is the wrong type", { heading: "Гарчиг", items: [{ value: 1, label: "нэг" }] }],
    ["it is the wrong section's document", CONTENT_DEFAULTS.hero],
  ])("%s → the default", async (_why, stored) => {
    await writeSection("about_stats", stored);
    await expect(getContent("about_stats")).resolves.toEqual(CONTENT_DEFAULTS.about_stats);
  });

  it("takes the row whole or not at all — no half-merge", async () => {
    // A good heading beside a bad list. Merging would give this year's title
    // over last year's figures, with nothing to show which is which.
    await writeSection("about_stats", { heading: "Шинэ гарчиг", items: [] });
    await expect(getContent("about_stats")).resolves.toEqual(CONTENT_DEFAULTS.about_stats);
  });

  it("says so in the log rather than in silence", async () => {
    await writeSection("hero", { heading: "Гарчиг" });
    await getContent("hero");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("a database outage never blanks a page", () => {
  it("answers with the default instead of throwing", async () => {
    memory.failOn = /site_content/u;
    await expect(getContent("footer")).resolves.toEqual(CONTENT_DEFAULTS.footer);
  });

  it("does so for every section", async () => {
    memory.failOn = /site_content/u;
    await expect(getContent("hero")).resolves.toEqual(CONTENT_DEFAULTS.hero);
    await expect(getContent("about_stats")).resolves.toEqual(CONTENT_DEFAULTS.about_stats);
  });
});

describe("the admin read does not hide the failure", () => {
  it("reports which sections are stored and which are still the default", async () => {
    await writeSection("footer", CONTENT_DEFAULTS.footer);

    const sections = await loadSectionsForAdmin();
    expect(sections.footer.stored).toBe(true);
    expect(sections.hero.stored).toBe(false);
    expect(sections.hero.value).toEqual(CONTENT_DEFAULTS.hero);
  });

  it("counts an unparseable row as not stored, so the form shows the default", async () => {
    await writeSection("hero", { heading: "Гарчиг" });
    const sections = await loadSectionsForAdmin();
    expect(sections.hero.stored).toBe(false);
    expect(sections.hero.value).toEqual(CONTENT_DEFAULTS.hero);
  });

  it("throws when the database is down, so the desk can say so", async () => {
    memory.failOn = /site_content/u;
    await expect(loadSectionsForAdmin()).rejects.toThrow();
  });
});
