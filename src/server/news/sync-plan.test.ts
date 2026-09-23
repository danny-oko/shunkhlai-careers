import { describe, expect, it } from "vitest";

import { blocksToDoc } from "@/lib/news/legacy";
import type { NewsArticle } from "@/lib/news/types";

import { type ExistingRow, planSync } from "./sync-plan";

/**
 * The sync writes to the database production reads, so its decisions are
 * pinned here: new rows are inserted, existing rows are only overwritten with
 * `--force`, placeholders are drafted and never deleted, and a slug clash is
 * refused before it can fail a run halfway.
 */

const NOW = "2026-09-23T00:00:00.000Z";

function story(id: string, slug = id.replace("art_", "")): NewsArticle {
  return {
    id,
    slug,
    title: "Гарчиг",
    lede: "Тэргүүн",
    category: "company",
    author: "Б",
    publishedAt: "2026-09-01",
    coverKey: "https://res.cloudinary.com/x/a.jpg",
    coverAlt: "",
    body: blocksToDoc([{ kind: "paragraph", text: "Бичвэр." }]),
    status: "published",
    featured: false,
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

const row = (id: string, slug = id.replace("art_", "")): ExistingRow => ({
  id,
  slug,
  status: "published",
  featured: 0,
});

describe("planSync", () => {
  it("inserts what is missing and keeps what exists without --force", () => {
    const plan = planSync({
      articles: [story("art_new"), story("art_old")],
      existing: [row("art_old")],
      placeholderIds: [],
      force: false,
      now: NOW,
    });

    expect(plan.inserted).toEqual(["art_new"]);
    expect(plan.kept).toEqual(["art_old"]);
    expect(plan.updated).toEqual([]);
    expect(plan.statements).toHaveLength(1);
    expect(plan.statements[0].sql).toMatch(/^INSERT INTO news_article .* ON CONFLICT\(id\) DO NOTHING$/u);
  });

  it("overwrites an existing row only with --force, and never its created_at", () => {
    const plan = planSync({
      articles: [story("art_old")],
      existing: [row("art_old")],
      placeholderIds: [],
      force: true,
      now: NOW,
    });

    expect(plan.updated).toEqual(["art_old"]);
    const [statement] = plan.statements;
    expect(statement.sql).toMatch(/^UPDATE news_article SET .* WHERE id = \?$/u);
    expect(statement.sql).not.toContain("created_at");
    expect(statement.params.at(-1)).toBe("art_old");
  });

  it("writes the body as RichDoc JSON and the flag as an integer", () => {
    const article = { ...story("art_new"), featured: true };
    const [statement] = planSync({
      articles: [article],
      existing: [],
      placeholderIds: [],
      force: false,
      now: NOW,
    }).statements;

    expect(statement.params).toContain(JSON.stringify(article.body));
    expect(statement.params).toContain(1);
    expect(statement.params.at(-1)).toBe(NOW);
  });

  it("refuses a slug another row already holds", () => {
    const plan = planSync({
      articles: [story("art_new", "taken")],
      existing: [row("art_someone_else", "taken")],
      placeholderIds: [],
      force: true,
      now: NOW,
    });

    expect(plan.blocked).toEqual(["art_new"]);
    expect(plan.statements).toHaveLength(0);
  });

  it("drafts the placeholders last, and nothing in the plan deletes", () => {
    const plan = planSync({
      articles: [story("art_new")],
      existing: [row("art_2af8b2ed10")],
      placeholderIds: ["art_2af8b2ed10", "art_e3264be05c"],
      force: false,
      now: NOW,
    });

    expect(plan.drafted).toEqual(["art_2af8b2ed10", "art_e3264be05c"]);
    const last = plan.statements.at(-1)!;
    expect(last.sql).toMatch(/^UPDATE news_article SET status = 'draft', featured = 0/u);
    expect(last.params).toEqual([NOW, "art_2af8b2ed10", "art_e3264be05c"]);
    expect(plan.statements.some((statement) => /\bDELETE\b/iu.test(statement.sql))).toBe(false);
  });

  it("takes the lead from every other row when it writes a featured story", () => {
    const plan = planSync({
      articles: [story("art_plain"), { ...story("art_lead"), featured: true }],
      existing: [row("art_lead")],
      placeholderIds: [],
      force: true,
      now: NOW,
    });

    const sqls = plan.statements.map((statement) => statement.note);
    expect(sqls).toEqual([
      "insert art_plain",
      "overwrite art_lead (--force)",
      "one lead: demote every row but art_lead",
    ]);
    const demote = plan.statements[2];
    expect(demote.sql).toBe(
      "UPDATE news_article SET featured = 0, updated_at = ? WHERE featured = 1 AND id <> ?",
    );
    expect(demote.params).toEqual([NOW, "art_lead"]);
  });

  it("does not demote anything for a featured story it leaves alone", () => {
    const plan = planSync({
      articles: [{ ...story("art_lead"), featured: true }],
      existing: [row("art_lead")],
      placeholderIds: [],
      force: false,
      now: NOW,
    });

    expect(plan.statements).toHaveLength(0);
  });
});
