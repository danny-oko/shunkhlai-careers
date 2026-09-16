import { describe, expect, it } from "vitest";

import {
  ARTICLE_LIMITS,
  articleFieldErrors,
  articleFormSchema,
  coverFileError,
} from "./schema";

/**
 * The editor's form is `required`-marked, so a browser refuses to submit most
 * of what is tested here. That is exactly why it is tested here: the browser's
 * check is a courtesy and this one is the rule, and a crafted POST straight at
 * the server action meets only this.
 */

const VALID = {
  title: "Шинэ агуулах ашиглалтад орлоо",
  lede: "Бүсийн агуулах бүрэн горимоор ажиллаж эхэллээ.",
  category: "company",
  author: "Б. Энхжаргал",
  publishedAt: "2026-09-15",
  coverAlt: "Агуулахын хүлээн авах талбай.",
  body: "Эхний догол мөр.",
  status: "published",
  featured: "",
  removeCover: "",
};

function parse(overrides: Record<string, string> = {}) {
  return articleFormSchema.safeParse({ ...VALID, ...overrides });
}

function errorsFor(overrides: Record<string, string>) {
  const result = parse(overrides);
  expect(result.success).toBe(false);
  return result.success ? {} : articleFieldErrors(result.error);
}

describe("articleFormSchema", () => {
  it("accepts a filled-in form", () => {
    const result = parse();

    expect(result.success).toBe(true);
    expect(result.success && result.data.title).toBe(VALID.title);
    expect(result.success && result.data.featured).toBe(false);
  });

  it("trims before it measures, so whitespace is not content", () => {
    expect(errorsFor({ title: "   " })).toHaveProperty("title");
    expect(errorsFor({ lede: "\n\t " })).toHaveProperty("lede");
    expect(errorsFor({ body: "  " })).toHaveProperty("body");
    expect(errorsFor({ author: " " })).toHaveProperty("author");
  });

  it("names every missing field, not just the first", () => {
    const errors = errorsFor({ title: "", lede: "", author: "", body: "" });

    expect(Object.keys(errors).sort()).toEqual(["author", "body", "lede", "title"]);
  });

  it("gives one message per field rather than a stack of them", () => {
    const errors = errorsFor({ title: "" });

    expect(Object.values(errors).every((message) => !message.includes("\n"))).toBe(true);
    expect(errors.title).toMatch(/Гарчиг/u);
  });

  it("answers in Mongolian", () => {
    const errors = errorsFor({ title: "", lede: "", publishedAt: "nonsense" });

    for (const message of Object.values(errors)) {
      expect(message, message).toMatch(/[Ѐ-ӿ]/u);
    }
  });

  it("holds the length limits", () => {
    expect(parse({ title: "т".repeat(ARTICLE_LIMITS.title) }).success).toBe(true);
    expect(errorsFor({ title: "т".repeat(ARTICLE_LIMITS.title + 1) })).toHaveProperty("title");

    expect(parse({ lede: "л".repeat(ARTICLE_LIMITS.lede) }).success).toBe(true);
    expect(errorsFor({ lede: "л".repeat(ARTICLE_LIMITS.lede + 1) })).toHaveProperty("lede");

    expect(errorsFor({ author: "а".repeat(ARTICLE_LIMITS.author + 1) })).toHaveProperty("author");
    expect(errorsFor({ coverAlt: "з".repeat(ARTICLE_LIMITS.coverAlt + 1) })).toHaveProperty(
      "coverAlt",
    );
    expect(errorsFor({ body: "б".repeat(ARTICLE_LIMITS.body + 1) })).toHaveProperty("body");
  });

  it("allows an empty image description — an article need not have a picture", () => {
    expect(parse({ coverAlt: "" }).success).toBe(true);
  });
});

describe("publishedAt", () => {
  it("takes a real calendar day", () => {
    expect(parse({ publishedAt: "2026-02-28" }).success).toBe(true);
    expect(parse({ publishedAt: "2024-02-29" }).success).toBe(true);
  });

  it("refuses a day that does not exist, which `new Date` would roll forward", () => {
    // `new Date("2026-02-30")` is the 2nd of March, silently. A date field
    // that accepts it files the article under the wrong day.
    expect(errorsFor({ publishedAt: "2026-02-30" })).toHaveProperty("publishedAt");
    expect(errorsFor({ publishedAt: "2026-04-31" })).toHaveProperty("publishedAt");
    expect(errorsFor({ publishedAt: "2026-13-01" })).toHaveProperty("publishedAt");
    expect(errorsFor({ publishedAt: "2025-02-29" })).toHaveProperty("publishedAt");
  });

  it("refuses anything that is not YYYY-MM-DD", () => {
    for (const value of ["", "2026-9-15", "15/09/2026", "2026-09-15T00:00:00Z", "tomorrow"]) {
      expect(errorsFor({ publishedAt: value }), value).toHaveProperty("publishedAt");
    }
  });
});

describe("enums", () => {
  it("refuses a category that is not a desk", () => {
    expect(errorsFor({ category: "sports" })).toHaveProperty("category");
    expect(errorsFor({ category: "" })).toHaveProperty("category");
  });

  it("refuses a status that is neither draft nor published", () => {
    expect(parse({ status: "draft" }).success).toBe(true);
    expect(errorsFor({ status: "archived" })).toHaveProperty("status");
    // The status comes from whichever submit button was pressed, so an absent
    // one means the request did not come from the form.
    expect(errorsFor({ status: "" })).toHaveProperty("status");
  });
});

describe("checkboxes", () => {
  it("reads an unchecked box as false however the browser omits it", () => {
    for (const value of ["", undefined, null] as unknown as string[]) {
      const result = parse({ featured: value });
      expect(result.success && result.data.featured, String(value)).toBe(false);
    }
  });

  it("reads a checked box as true", () => {
    const featured = parse({ featured: "on" });
    expect(featured.success && featured.data.featured).toBe(true);
    const removeCover = parse({ removeCover: "on" });
    expect(removeCover.success && removeCover.data.removeCover).toBe(true);
  });

  it("refuses a value no checkbox produces", () => {
    expect(errorsFor({ featured: "yes" })).toHaveProperty("featured");
  });
});

describe("coverFileError", () => {
  const file = (type: string, bytes: number) =>
    ({ type, size: bytes, name: "cover" }) as File;

  it("passes the four raster types the store can serve", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(coverFileError(file(type, 1024)), type).toBe(null);
    }
  });

  it("refuses anything else, SVG included", () => {
    // SVG is a document that can carry script, and it would be served from
    // this site's own origin.
    for (const type of ["image/svg+xml", "image/gif", "application/pdf", "text/html", ""]) {
      expect(coverFileError(file(type, 1024)), type).not.toBe(null);
    }
  });

  it("refuses a file over the size limit but allows one exactly at it", () => {
    expect(coverFileError(file("image/jpeg", ARTICLE_LIMITS.coverBytes))).toBe(null);
    expect(coverFileError(file("image/jpeg", ARTICLE_LIMITS.coverBytes + 1))).not.toBe(null);
  });

  it("answers in Mongolian", () => {
    expect(coverFileError(file("text/html", 10))).toMatch(/[Ѐ-ӿ]/u);
    expect(coverFileError(file("image/jpeg", 99_000_000))).toMatch(/[Ѐ-ӿ]/u);
  });
});
