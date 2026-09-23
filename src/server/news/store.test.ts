import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";
import { blocksToDoc } from "@/lib/news/legacy";

import {
  countByCategory,
  deleteArticle,
  getArticleById,
  getArticleBySlug,
  getMedia,
  listArticles,
  putMedia,
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
 * The real store talks to the customer's PostgreSQL, which these tests never
 * reach. `@/lib/db` is swapped for a drizzle client over PGlite — Postgres
 * itself, compiled to WASM, in this process — with the tables created from the
 * committed migration (see `src/lib/db/testing.ts`). So the SQL the store
 * generates is executed for real, against the real schema, including the
 * `jsonb` body and the `boolean` this port introduced. Nothing in this file
 * can reach the network.
 */

const memory = vi.hoisted(() => ({
  db: null as TestDatabase | null,
  /** A statement matching this throws, as a database outage mid-save would. */
  failOn: null as RegExp | null,
}));

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");

  memory.db = await createTestDatabase({
    onQuery: (sql) => {
      if (memory.failOn?.test(sql)) throw new Error(`database unavailable: ${sql.slice(0, 40)}`);
    },
  });

  return { ...schema, getDb: () => memory.db!.db };
});

const BODY = blocksToDoc([{ kind: "paragraph", text: "Туршилтын бичвэр." }]);

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

beforeAll(async () => {
  // Touch the store so the mocked module (and its PGlite) is built once.
  await listArticles({ status: "all" });
});

beforeEach(async () => {
  // Empty tables per case, so no test sees what the previous one left.
  memory.failOn = null;
  await memory.db!.reset();
});

describe("saveArticle — create", () => {
  it("assigns an id and a slug transliterated from the title", async () => {
    const saved = await article();

    expect(saved.id).toMatch(/^art_[\da-f]{10}$/u);
    expect(saved.slug).toBe("shine-terminal-neelee");
    expect(saved.createdAt).toBe(saved.updatedAt);
  });

  it("gives two articles with the same title distinct slugs", async () => {
    const first = await article();
    const second = await article();

    expect(second.id).not.toBe(first.id);
    expect(second.slug).toBe(`${first.slug}-2`);
  });

  it("trims the fields a careless paste brings whitespace into", async () => {
    const saved = await article({ title: "  Гарчиг  ", lede: "  Тэргүүн  ", author: " Б. Б " });

    expect(saved.title).toBe("Гарчиг");
    expect(saved.lede).toBe("Тэргүүн");
    expect(saved.author).toBe("Б. Б");
  });
});

describe("saveArticle — update", () => {
  it("keeps the id and does not churn the slug when the title is unchanged", async () => {
    const original = await article();
    const updated = await saveArticle({
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
    expect(await listArticles({ status: "all" })).toHaveLength(1);
  });

  it("re-slugs when the title changes", async () => {
    const original = await article();
    const updated = await saveArticle({ ...original, title: "Лаборатори өргөжлөө" });

    expect(updated.id).toBe(original.id);
    expect(updated.slug).toBe("laboratori-orgojloo");
    expect(await getArticleBySlug(original.slug)).toBe(null);
  });

  it("does not collide with another article when re-titled", async () => {
    const first = await article({ title: "Нэгдүгээр мэдээ" });
    const second = await article({ title: "Хоёрдугаар мэдээ" });

    const renamed = await saveArticle({ ...second, title: first.title });

    expect(renamed.slug).toBe(`${first.slug}-2`);
    expect((await getArticleBySlug(first.slug))?.id).toBe(first.id);
  });

  it("ignores an id that matches nothing by creating instead", async () => {
    const saved = await saveArticle({ ...(await article({ title: "А" })), id: "art_ffffffffff" });

    expect(saved.id).not.toBe("art_ffffffffff");
    expect(await listArticles({ status: "all" })).toHaveLength(2);
  });
});

describe("listArticles", () => {
  it("returns published only by default", async () => {
    await article({ title: "Нийтэлсэн", status: "published" });
    await article({ title: "Ноорог", status: "draft" });

    expect((await listArticles()).map((row) => row.title)).toEqual(["Нийтэлсэн"]);
    expect(await listArticles({ status: "all" })).toHaveLength(2);
    expect((await listArticles({ status: "draft" })).map((row) => row.title)).toEqual(["Ноорог"]);
  });

  it("sorts newest first", async () => {
    await article({ title: "Хуучин", publishedAt: "2026-07-01" });
    await article({ title: "Шинэ", publishedAt: "2026-09-01" });
    await article({ title: "Дунд", publishedAt: "2026-08-01" });

    expect((await listArticles()).map((row) => row.title)).toEqual(["Шинэ", "Дунд", "Хуучин"]);
  });

  it("lifts a featured article above its date-mates but not above a newer one", async () => {
    await article({ title: "Ижил өдөр, энгийн", publishedAt: "2026-08-01" });
    await article({ title: "Ижил өдөр, гол", publishedAt: "2026-08-01", featured: true });
    await article({ title: "Дараа өдөр", publishedAt: "2026-08-02" });

    expect((await listArticles()).map((row) => row.title)).toEqual([
      "Дараа өдөр",
      "Ижил өдөр, гол",
      "Ижил өдөр, энгийн",
    ]);
  });

  it("filters by category", async () => {
    await article({ title: "Компанийх", category: "company" });
    await article({ title: "Салбарынх", category: "industry" });

    expect((await listArticles({ category: "industry" })).map((row) => row.title)).toEqual([
      "Салбарынх",
    ]);
    // A null category is "no filter", not "a category called null".
    expect(await listArticles({ category: null })).toHaveLength(2);
  });

  it("searches the title, the standfirst and the byline, case-insensitively", async () => {
    await article({ title: "Лаборатори", lede: "Итгэмжлэл", author: "Д. Отгонбаяр" });
    await article({ title: "Агуулах", lede: "Нөөц", author: "Б. Энхжаргал" });

    expect(await listArticles({ search: "лабор" })).toHaveLength(1);
    expect(await listArticles({ search: "ЛАБОР" })).toHaveLength(1);
    expect(await listArticles({ search: "итгэмжлэл" })).toHaveLength(1);
    expect(await listArticles({ search: "отгонбаяр" })).toHaveLength(1);
    expect(await listArticles({ search: "  " })).toHaveLength(2);
    expect(await listArticles({ search: "байхгүй" })).toHaveLength(0);
  });

  it("honours a limit, including zero and one larger than the set", async () => {
    await article({ title: "А", publishedAt: "2026-09-03" });
    await article({ title: "Б", publishedAt: "2026-09-02" });
    await article({ title: "В", publishedAt: "2026-09-01" });

    expect((await listArticles({ limit: 2 })).map((row) => row.title)).toEqual(["А", "Б"]);
    expect(await listArticles({ limit: 0 })).toHaveLength(0);
    expect(await listArticles({ limit: 99 })).toHaveLength(3);
    expect(await listArticles({ limit: -5 })).toHaveLength(0);
  });
});

describe("countByCategory", () => {
  it("names every category even when it has nothing in it", async () => {
    await article({ category: "company" });

    expect(await countByCategory()).toEqual({ company: 1, industry: 0, society: 0, people: 0 });
  });

  it("counts published only unless asked for all", async () => {
    await article({ category: "people", status: "draft" });

    expect((await countByCategory()).people).toBe(0);
    expect((await countByCategory("all")).people).toBe(1);
  });
});

describe("deleteArticle", () => {
  it("returns false for an id that is not there", async () => {
    expect(await deleteArticle("art_0000000000")).toBe(false);
  });

  it("removes the article and its uploaded cover", async () => {
    const key = await putMedia(new Uint8Array([1, 2, 3]), "image/png");
    const saved = await article({ coverKey: key });

    expect(await deleteArticle(saved.id)).toBe(true);
    expect(await getArticleById(saved.id)).toBe(null);
    expect(await getMedia(key)).toBe(null);
  });

  it("leaves a seeded cover alone — those files are not the store's to delete", async () => {
    const saved = await article({ coverKey: "seed:brand/logo-mark.png" });

    expect(await deleteArticle(saved.id)).toBe(true);
    expect(await getMedia("seed:brand/logo-mark.png")).not.toBe(null);
  });
});

describe("coverKey on update", () => {
  it("keeps the existing cover when the key is absent", async () => {
    const key = await putMedia(new Uint8Array([9]), "image/png");
    const saved = await article({ coverKey: key });

    const updated = await saveArticle({
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
    expect(await getMedia(key)).not.toBe(null);
  });

  it("removes the cover — and its bytes — when the key is an explicit null", async () => {
    const key = await putMedia(new Uint8Array([9]), "image/png");
    const saved = await article({ coverKey: key });

    const updated = await saveArticle({ ...saved, coverKey: null });

    expect(updated.coverKey).toBe(null);
    expect(await getMedia(key)).toBe(null);
  });

  it("drops the bytes of the cover it replaces", async () => {
    const first = await putMedia(new Uint8Array([1]), "image/png");
    const second = await putMedia(new Uint8Array([2]), "image/png");
    const saved = await article({ coverKey: first });

    const updated = await saveArticle({ ...saved, coverKey: second });

    expect(updated.coverKey).toBe(second);
    expect(await getMedia(first)).toBe(null);
    expect(await getMedia(second)).not.toBe(null);
  });

  it("does not delete the cover when the same key is saved again", async () => {
    const key = await putMedia(new Uint8Array([7]), "image/png");
    const saved = await article({ coverKey: key });

    const updated = await saveArticle({ ...saved, coverKey: key });

    expect(updated.coverKey).toBe(key);
    expect(await getMedia(key)).not.toBe(null);
  });
});

describe("media", () => {
  it("round-trips bytes and content type", async () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const key = await putMedia(bytes, "image/webp");

    expect(key).toMatch(/^med_[\da-f]{12}$/u);

    const read = await getMedia(key);
    expect(read?.contentType).toBe("image/webp");
    expect([...(read?.bytes ?? [])]).toEqual([...bytes]);
  });

  it("splits a large upload across rows and reads it back whole", async () => {
    // 1.2 MB of bytes is ~1.6 MB of base64: four 500k-character chunks. The
    // chunking came from D1's 2 MB value cap and is kept on Postgres, so the
    // rows an old cover was written as still read back.
    const bytes = new Uint8Array(1_200_000).map((_, index) => index % 251);
    const key = await putMedia(bytes, "image/jpeg");

    const { rows } = await memory.db!.client.query<{ chunk_index: number; size: number }>(
      "SELECT chunk_index, length(data) AS size FROM news_media WHERE key = $1 ORDER BY chunk_index",
      [key],
    );
    expect(rows.map((row) => row.chunk_index)).toEqual([0, 1, 2, 3]);
    expect(rows.every((row) => Number(row.size) <= 500_000)).toBe(true);

    const read = await getMedia(key);
    expect(read?.contentType).toBe("image/jpeg");
    expect(Buffer.compare(read!.bytes, Buffer.from(bytes))).toBe(0);
  });

  it("returns null for a key nothing wrote", async () => {
    expect(await getMedia("med_aaaaaaaaaaaa")).toBe(null);
    expect(await getMedia("")).toBe(null);
  });

  it("resolves a seed key to a real file under public/", async () => {
    const read = await getMedia("seed:brand/logo-mark.png");

    expect(read?.contentType).toBe("image/png");
    expect((read?.bytes.byteLength ?? 0) > 0).toBe(true);
  });

  it("refuses to read anything outside public/", async () => {
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
      await expect(getMedia(key), key).resolves.toBe(null);
    }
  });

  it("refuses a file under public/ that is not an image", async () => {
    // Containment is not the only rule: the route sets Content-Type from this,
    // so a key naming a non-image would serve bytes under a made-up type.
    expect(await getMedia("seed:brand/../next.svg")).toBe(null);
  });

  it("returns null for a real path with no extension it serves", async () => {
    expect(await getMedia("seed:brand")).toBe(null);
  });
});

describe("bodies", () => {
  it("stores a RichDoc and reads the same document back", async () => {
    const saved = await article();

    expect((await getArticleById(saved.id))?.body).toEqual(BODY);
  });

  it("reads a row written before rich text — a NewsBlock[] body — as a document", async () => {
    // Rows laid down by the first seed hold the old block array. They must
    // render without a migration.
    await memory.db!.client.query(
      `INSERT INTO news_article (id, slug, title, lede, category, author, published_at,
         cover_key, cover_alt, body_json, status, featured, created_at, updated_at)
       VALUES ('art_legacy0000', 'legacy', 'Хуучин', 'Тэргүүн', 'company', 'Б', '2026-09-01',
         NULL, '', $1, 'published', false, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`,
      [
        JSON.stringify([
          { kind: "heading", text: "Гарчиг" },
          { kind: "paragraph", text: "Бичвэр." },
        ]),
      ],
    );

    const read = await getArticleBySlug("legacy");
    expect(read?.body.type).toBe("doc");
    expect(read?.body.content.map((block) => block.type)).toEqual(["heading", "paragraph"]);
  });

  it("survives a row whose body is not JSON at all", async () => {
    // `jsonb` will not take `{not json`, so the corrupt row is a JSON *string*
    // holding it — which is exactly what a row copied verbatim out of D1's
    // TEXT column would be, and `parseBody` still has to survive it.
    await memory.db!.client.query(
      `INSERT INTO news_article (id, slug, title, lede, category, author, published_at,
         cover_key, cover_alt, body_json, status, featured, created_at, updated_at)
       VALUES ('art_broken0000', 'broken', 'Эвдэрсэн', 'Т', 'company', 'Б', '2026-09-01',
         NULL, '', to_jsonb('{not json'::text), 'published', false,
         '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`,
    );

    expect((await getArticleBySlug("broken"))?.body.type).toBe("doc");
  });
});

describe("URL covers", () => {
  const CLOUDINARY = "https://res.cloudinary.com/doxmbmqjm/image/upload/v1/a.jpg";

  it("stores an https cover as-is", async () => {
    const saved = await article({ coverKey: CLOUDINARY });

    expect((await getArticleById(saved.id))?.coverKey).toBe(CLOUDINARY);
  });

  it("drops the uploaded bytes when a URL replaces them", async () => {
    const key = await putMedia(new Uint8Array([4, 5]), "image/png");
    const saved = await article({ coverKey: key });

    const updated = await saveArticle({ ...saved, coverKey: CLOUDINARY });

    expect(updated.coverKey).toBe(CLOUDINARY);
    expect(await getMedia(key)).toBe(null);
  });

  it("never looks a URL up as media, and deletes nothing for one", async () => {
    const saved = await article({ coverKey: CLOUDINARY });
    const other = await putMedia(new Uint8Array([6]), "image/png");

    expect(await getMedia(CLOUDINARY)).toBe(null);
    expect(await deleteArticle(saved.id)).toBe(true);
    expect(await getMedia(other)).not.toBe(null);
  });
});

describe("write order — a failure leaves an orphan, never a broken cover", () => {
  it("keeps the old upload when the UPDATE that replaces it fails", async () => {
    const old = await putMedia(new Uint8Array([1, 2]), "image/png");
    const saved = await article({ coverKey: old });

    memory.failOn = /^update "news_article"/iu;
    await expect(
      saveArticle({ ...saved, coverKey: "https://res.cloudinary.com/x/new.jpg" }),
    ).rejects.toThrow();
    memory.failOn = null;

    // The row still names the old cover, so its bytes must still be there.
    expect((await getArticleById(saved.id))?.coverKey).toBe(old);
    expect(await getMedia(old)).not.toBe(null);
  });

  it("keeps the cover when deleting the row fails", async () => {
    const key = await putMedia(new Uint8Array([3]), "image/png");
    const saved = await article({ coverKey: key });

    memory.failOn = /^delete from "news_article"/iu;
    await expect(deleteArticle(saved.id)).rejects.toThrow();
    memory.failOn = null;

    expect(await getArticleById(saved.id)).not.toBe(null);
    expect(await getMedia(key)).not.toBe(null);
  });
});
