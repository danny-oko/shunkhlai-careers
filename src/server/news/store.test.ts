import { beforeEach, describe, expect, it } from "vitest";

import type { NewsBlock } from "@/lib/news/types";

import {
  countByCategory,
  deleteArticle,
  getArticleById,
  getArticleBySlug,
  getMedia,
  listArticles,
  putMedia,
  resetForTests,
  saveArticle,
} from "./store";

/**
 * The store is the newsroom's database, and three of its behaviours are the
 * kind that only a test pins down: the slug must survive an edit that does not
 * touch the headline (a published URL is a promise), `coverKey` means three
 * different things depending on whether it is absent, a string, or null, and
 * `getMedia` is the one function here that turns a stored string into a
 * filesystem read.
 *
 * State lives on `globalThis`, so every case starts from `resetForTests()`
 * rather than from whatever the previous one left behind.
 */

const BODY: NewsBlock[] = [{ kind: "paragraph", text: "Туршилтын бичвэр." }];

function article(overrides: Partial<Parameters<typeof saveArticle>[0]> = {}) {
  return saveArticle({
    title: "Шинэ терминал нээлээ",
    lede: "Тэргүүн үг.",
    category: "company",
    author: "Б. Энхжаргал",
    publishedAt: "2026-09-01",
    coverAlt: "",
    body: BODY,
    status: "published",
    featured: false,
    ...overrides,
  });
}

beforeEach(() => {
  resetForTests();
});

describe("saveArticle — create", () => {
  it("assigns an id and a slug transliterated from the title", () => {
    const saved = article();

    expect(saved.id).toMatch(/^art_[\da-f]{10}$/u);
    expect(saved.slug).toBe("shine-terminal-neelee");
    expect(saved.createdAt).toBe(saved.updatedAt);
  });

  it("gives two articles with the same title distinct slugs", () => {
    const first = article();
    const second = article();

    expect(second.id).not.toBe(first.id);
    expect(second.slug).toBe(`${first.slug}-2`);
  });

  it("trims the fields a careless paste brings whitespace into", () => {
    const saved = article({ title: "  Гарчиг  ", lede: "  Тэргүүн  ", author: " Б. Б " });

    expect(saved.title).toBe("Гарчиг");
    expect(saved.lede).toBe("Тэргүүн");
    expect(saved.author).toBe("Б. Б");
  });
});

describe("saveArticle — update", () => {
  it("keeps the id and does not churn the slug when the title is unchanged", () => {
    const original = article();
    const updated = saveArticle({
      id: original.id,
      title: original.title,
      lede: "Өөрчилсөн тэргүүн үг.",
      category: "society",
      author: original.author,
      publishedAt: original.publishedAt,
      coverAlt: "",
      body: BODY,
      status: "published",
      featured: true,
    });

    expect(updated.id).toBe(original.id);
    // The whole point: a typo fixed in the standfirst must not break every
    // link already published to this story.
    expect(updated.slug).toBe(original.slug);
    expect(updated.lede).toBe("Өөрчилсөн тэргүүн үг.");
    expect(updated.category).toBe("society");
    expect(listArticles({ status: "all" })).toHaveLength(1);
  });

  it("re-slugs when the title changes", () => {
    const original = article();
    const updated = saveArticle({ ...original, title: "Лаборатори өргөжлөө" });

    expect(updated.id).toBe(original.id);
    expect(updated.slug).toBe("laboratori-orgojloo");
    expect(getArticleBySlug(original.slug)).toBe(null);
  });

  it("does not collide with another article when re-titled", () => {
    const first = article({ title: "Нэгдүгээр мэдээ" });
    const second = article({ title: "Хоёрдугаар мэдээ" });

    const renamed = saveArticle({ ...second, title: first.title });

    expect(renamed.slug).toBe(`${first.slug}-2`);
    expect(getArticleBySlug(first.slug)?.id).toBe(first.id);
  });

  it("ignores an id that matches nothing by creating instead", () => {
    const saved = saveArticle({ ...article({ title: "А" }), id: "art_ffffffffff" });

    expect(saved.id).not.toBe("art_ffffffffff");
    expect(listArticles({ status: "all" })).toHaveLength(2);
  });
});

describe("listArticles", () => {
  it("returns published only by default", () => {
    article({ title: "Нийтэлсэн", status: "published" });
    article({ title: "Ноорог", status: "draft" });

    expect(listArticles().map((row) => row.title)).toEqual(["Нийтэлсэн"]);
    expect(listArticles({ status: "all" })).toHaveLength(2);
    expect(listArticles({ status: "draft" }).map((row) => row.title)).toEqual(["Ноорог"]);
  });

  it("sorts newest first", () => {
    article({ title: "Хуучин", publishedAt: "2026-07-01" });
    article({ title: "Шинэ", publishedAt: "2026-09-01" });
    article({ title: "Дунд", publishedAt: "2026-08-01" });

    expect(listArticles().map((row) => row.title)).toEqual(["Шинэ", "Дунд", "Хуучин"]);
  });

  it("lifts a featured article above its date-mates but not above a newer one", () => {
    article({ title: "Ижил өдөр, энгийн", publishedAt: "2026-08-01" });
    article({ title: "Ижил өдөр, гол", publishedAt: "2026-08-01", featured: true });
    article({ title: "Дараа өдөр", publishedAt: "2026-08-02" });

    expect(listArticles().map((row) => row.title)).toEqual([
      "Дараа өдөр",
      "Ижил өдөр, гол",
      "Ижил өдөр, энгийн",
    ]);
  });

  it("filters by category", () => {
    article({ title: "Компанийх", category: "company" });
    article({ title: "Салбарынх", category: "industry" });

    expect(listArticles({ category: "industry" }).map((row) => row.title)).toEqual([
      "Салбарынх",
    ]);
    // A null category is "no filter", not "a category called null".
    expect(listArticles({ category: null })).toHaveLength(2);
  });

  it("searches the title, the standfirst and the byline, case-insensitively", () => {
    article({ title: "Лаборатори", lede: "Итгэмжлэл", author: "Д. Отгонбаяр" });
    article({ title: "Агуулах", lede: "Нөөц", author: "Б. Энхжаргал" });

    expect(listArticles({ search: "лабор" })).toHaveLength(1);
    expect(listArticles({ search: "ЛАБОР" })).toHaveLength(1);
    expect(listArticles({ search: "итгэмжлэл" })).toHaveLength(1);
    expect(listArticles({ search: "отгонбаяр" })).toHaveLength(1);
    expect(listArticles({ search: "  " })).toHaveLength(2);
    expect(listArticles({ search: "байхгүй" })).toHaveLength(0);
  });

  it("honours a limit, including zero and one larger than the set", () => {
    article({ title: "А", publishedAt: "2026-09-03" });
    article({ title: "Б", publishedAt: "2026-09-02" });
    article({ title: "В", publishedAt: "2026-09-01" });

    expect(listArticles({ limit: 2 }).map((row) => row.title)).toEqual(["А", "Б"]);
    expect(listArticles({ limit: 0 })).toHaveLength(0);
    expect(listArticles({ limit: 99 })).toHaveLength(3);
    expect(listArticles({ limit: -5 })).toHaveLength(0);
  });
});

describe("countByCategory", () => {
  it("names every category even when it has nothing in it", () => {
    article({ category: "company" });

    expect(countByCategory()).toEqual({ company: 1, industry: 0, society: 0, people: 0 });
  });

  it("counts published only unless asked for all", () => {
    article({ category: "people", status: "draft" });

    expect(countByCategory().people).toBe(0);
    expect(countByCategory("all").people).toBe(1);
  });
});

describe("deleteArticle", () => {
  it("returns false for an id that is not there", () => {
    expect(deleteArticle("art_0000000000")).toBe(false);
  });

  it("removes the article and its uploaded cover", () => {
    const key = putMedia(new Uint8Array([1, 2, 3]), "image/png");
    const saved = article({ coverKey: key });

    expect(deleteArticle(saved.id)).toBe(true);
    expect(getArticleById(saved.id)).toBe(null);
    expect(getMedia(key)).toBe(null);
  });

  it("leaves a seeded cover alone — those files are not the store's to delete", () => {
    const saved = article({ coverKey: "seed:brand/logo-mark.png" });

    expect(deleteArticle(saved.id)).toBe(true);
    expect(getMedia("seed:brand/logo-mark.png")).not.toBe(null);
  });
});

describe("coverKey on update", () => {
  it("keeps the existing cover when the key is absent", () => {
    const key = putMedia(new Uint8Array([9]), "image/png");
    const saved = article({ coverKey: key });

    const updated = saveArticle({
      id: saved.id,
      title: saved.title,
      lede: saved.lede,
      category: saved.category,
      author: saved.author,
      publishedAt: saved.publishedAt,
      coverAlt: saved.coverAlt,
      body: saved.body,
      status: saved.status,
      featured: saved.featured,
    });

    expect(updated.coverKey).toBe(key);
    expect(getMedia(key)).not.toBe(null);
  });

  it("removes the cover — and its bytes — when the key is an explicit null", () => {
    const key = putMedia(new Uint8Array([9]), "image/png");
    const saved = article({ coverKey: key });

    const updated = saveArticle({ ...saved, coverKey: null });

    expect(updated.coverKey).toBe(null);
    expect(getMedia(key)).toBe(null);
  });

  it("drops the bytes of the cover it replaces", () => {
    const first = putMedia(new Uint8Array([1]), "image/png");
    const second = putMedia(new Uint8Array([2]), "image/png");
    const saved = article({ coverKey: first });

    const updated = saveArticle({ ...saved, coverKey: second });

    expect(updated.coverKey).toBe(second);
    expect(getMedia(first)).toBe(null);
    expect(getMedia(second)).not.toBe(null);
  });

  it("does not delete the cover when the same key is saved again", () => {
    const key = putMedia(new Uint8Array([7]), "image/png");
    const saved = article({ coverKey: key });

    const updated = saveArticle({ ...saved, coverKey: key });

    expect(updated.coverKey).toBe(key);
    expect(getMedia(key)).not.toBe(null);
  });
});

describe("media", () => {
  it("round-trips bytes and content type", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const key = putMedia(bytes, "image/webp");

    expect(key).toMatch(/^med_[\da-f]{12}$/u);

    const read = getMedia(key);
    expect(read?.contentType).toBe("image/webp");
    expect([...(read?.bytes ?? [])]).toEqual([...bytes]);
  });

  it("returns null for a key nothing wrote", () => {
    expect(getMedia("med_aaaaaaaaaaaa")).toBe(null);
    expect(getMedia("")).toBe(null);
  });

  it("resolves a seed key to a real file under public/", () => {
    const read = getMedia("seed:brand/logo-mark.png");

    expect(read?.contentType).toBe("image/png");
    expect((read?.bytes.byteLength ?? 0) > 0).toBe(true);
  });

  it("refuses to read anything outside public/", () => {
    // Every one of these is a way to name a file the newsroom does not own.
    // None of them may read, and none of them may throw — a throw inside a
    // route handler is a 500 where a 404 was the honest answer.
    const escapes = [
      "seed:../package.json",
      "seed:../../../etc/passwd",
      "seed:/etc/passwd",
      "seed:brand/../../package.json",
      "seed:./../../package.json",
      "seed:brand/../../../../../../etc/hosts",
      "seed:",
      "seed:brand/",
      "seed:\0brand/logo-mark.png",
    ];

    for (const key of escapes) {
      expect(() => getMedia(key), key).not.toThrow();
      expect(getMedia(key), key).toBe(null);
    }
  });

  it("refuses a file under public/ that is not an image", () => {
    // Containment is not the only rule: the route sets Content-Type from this,
    // so a key naming a non-image would serve bytes under a made-up type.
    expect(getMedia("seed:brand/../next.svg")).toBe(null);
  });

  it("returns null for a real path with no extension it serves", () => {
    expect(getMedia("seed:brand")).toBe(null);
  });
});
