import { describe, expect, it, vi } from "vitest";

import { D1_TABLES, isoToDate, msToDate, toBoolean, toJson } from "./d1-rows";

const spec = (name: string) => {
  const found = D1_TABLES.find((table) => table.name === name);
  if (!found) throw new Error(`no spec for ${name}`);
  return found;
};

/**
 * The one-way trip out of SQLite. Every assertion here is about a type the old
 * database did not have: a timestamp instead of an integer of milliseconds, a
 * boolean instead of 0/1, a parsed document instead of a string of JSON.
 */
describe("value conversions", () => {
  it("turns epoch milliseconds into a Date", () => {
    expect(msToDate(1_758_438_797_307)?.toISOString()).toBe("2025-09-21T07:13:17.307Z");
    expect(msToDate(null)).toBeNull();
    expect(msToDate("")).toBeNull();
  });

  it("reads SQLite's 0/1 as a boolean", () => {
    expect(toBoolean(1)).toBe(true);
    expect(toBoolean(0)).toBe(false);
    expect(toBoolean("1")).toBe(true);
    expect(toBoolean(null)).toBe(false);
  });

  it("parses body_json, and keeps an unparseable one rather than dropping it", () => {
    expect(toJson('[{"kind":"paragraph"}]', "art_1")).toEqual([{ kind: "paragraph" }]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toJson("{not json", "art_1")).toBe("{not json");
    warn.mockRestore();
  });

  it("falls back to now for a date it cannot read, and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isoToDate("2026-09-21T07:13:17.307Z", "x").toISOString()).toBe(
      "2026-09-21T07:13:17.307Z",
    );
    expect(isoToDate("not a date", "x")).toBeInstanceOf(Date);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("table specs", () => {
  it("covers all seven D1 tables, in FK-safe order", () => {
    expect(D1_TABLES.map((table) => table.name)).toEqual([
      "applicant_link",
      "applicant_profile",
      "applicant_account",
      "applicant_file",
      "application_log",
      "news_article",
      "news_media",
    ]);
  });

  it("converts a news_article row into the shape the pg table wants", () => {
    const row = spec("news_article").convert({
      id: "art_1",
      slug: "slug",
      title: "Гарчиг",
      lede: "Тольдох",
      category: "company",
      author: "Redaktor",
      published_at: "2026-09-01",
      cover_key: null,
      cover_alt: null,
      body_json: '{"kind":"doc","children":[]}',
      status: "published",
      featured: 1,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-02T00:00:00.000Z",
    });

    expect(row).toMatchObject({
      id: "art_1",
      // An editorial YYYY-MM-DD: text on both sides, deliberately.
      publishedAt: "2026-09-01",
      coverKey: null,
      coverAlt: "",
      bodyJson: { kind: "doc", children: [] },
      featured: true,
    });
    expect((row.createdAt as Date).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect((row.updatedAt as Date).toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });

  it("converts an applicant_account row, timestamps and all", () => {
    const row = spec("applicant_account").convert({
      id: "acc_1",
      email: "a@b.mn",
      clerk_user_id: null,
      data_json: "{}",
      created_at: 1_758_438_797_307,
      updated_at: 1_758_438_797_307,
    });
    expect(row.clerkUserId).toBeNull();
    expect((row.createdAt as Date).toISOString()).toBe("2025-09-21T07:13:17.307Z");
  });

  it("refuses to invent a value for a NOT NULL column that is null in D1", () => {
    expect(() => spec("applicant_account").convert({ id: "acc_1", email: null })).toThrow(
      /applicant_account\.email is null in D1/u,
    );
  });
});
