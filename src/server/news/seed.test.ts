import { describe, expect, it } from "vitest";

import { blocksToDoc } from "@/lib/news/legacy";
import type { BlockNode } from "@/lib/news/shared/rich-text";

import { type GalleryImage, seedArticles, withGallery } from "./seed";

/**
 * The seed is the owner's content, so what matters is that the sync lays it
 * down exactly as mapped: the right photograph on the right story, the gallery
 * in the docx's order, and nothing invented where a picture is missing.
 */

const BASE = "https://res.cloudinary.com/doxmbmqjm/image/upload/";

const image = (name: string, title: string | null = null): GalleryImage => ({
  src: `${BASE}${name}.jpg`,
  alt: `alt ${name}`,
  title,
});

function shape(content: BlockNode[]): string[] {
  return content.map((block) =>
    block.type === "image" ? `img:${block.attrs.src.slice(BASE.length, -4)}` : block.type,
  );
}

describe("withGallery", () => {
  it("puts one picture after each paragraph, in order", () => {
    const doc = blocksToDoc([
      { kind: "paragraph", text: "Нэг." },
      { kind: "paragraph", text: "Хоёр." },
      { kind: "paragraph", text: "Гурав." },
    ]);

    expect(shape(withGallery(doc, [image("a"), image("b")]).content)).toEqual([
      "paragraph",
      "img:a",
      "paragraph",
      "img:b",
      "paragraph",
    ]);
  });

  it("appends what is left once the paragraphs run out", () => {
    const doc = blocksToDoc([{ kind: "paragraph", text: "Ганц догол мөр." }]);

    expect(shape(withGallery(doc, [image("a"), image("b"), image("c")]).content)).toEqual([
      "paragraph",
      "img:a",
      "img:b",
      "img:c",
    ]);
  });

  it("only uses top-level paragraphs as slots", () => {
    const doc = blocksToDoc([
      { kind: "heading", text: "Гарчиг" },
      { kind: "quote", text: "Ишлэл.", attribution: "Хэн нэгэн" },
      { kind: "list", items: ["нэг", "хоёр"] },
      { kind: "paragraph", text: "Бичвэр." },
    ]);

    expect(shape(withGallery(doc, [image("a"), image("b")]).content)).toEqual([
      "heading",
      "blockquote",
      "bulletList",
      "paragraph",
      "img:a",
      "img:b",
    ]);
  });

  it("carries alt and caption, and leaves the document alone with no gallery", () => {
    const doc = blocksToDoc([{ kind: "paragraph", text: "Бичвэр." }]);
    const [, picture] = withGallery(doc, [image("a", "Тайлбар")]).content;

    expect(picture).toEqual({
      type: "image",
      attrs: { src: `${BASE}a.jpg`, alt: "alt a", title: "Тайлбар", width: null, height: null },
    });
    expect(withGallery(doc, [])).toEqual(doc);
  });

  it("drops a picture whose source is not https, as every saved body would", () => {
    const doc = blocksToDoc([{ kind: "paragraph", text: "Бичвэр." }]);
    const unsafe = { src: "http://example.org/a.jpg", alt: "", title: null };

    expect(shape(withGallery(doc, [unsafe]).content)).toEqual(["paragraph"]);
  });
});

describe("seedArticles", () => {
  const articles = seedArticles();
  const byId = new Map(articles.map((article) => [article.id, article]));

  it("is the owner's nine articles, with their stable ids and slugs", () => {
    expect(articles).toHaveLength(9);
    expect(byId.get("art_shunkhlai_festival_2026")?.slug).toBe("shunkhlai-festival-2026");
    expect(new Set(articles.map((article) => article.slug)).size).toBe(9);
  });

  it("uses the mapped Cloudinary cover, never a seed: key", () => {
    for (const article of articles) {
      expect(article.coverKey === null || article.coverKey.startsWith(BASE), article.id).toBe(true);
    }
    expect(byId.get("art_shunkhlai_festival_2026")?.coverKey).toBe(
      `${BASE}v1790147704/801963458_1573087138185165_8086616411463813439_n_gzharv.jpg`,
    );
  });

  it("leaves the mental-health story without a cover until one is supplied", () => {
    expect(byId.get("art_mental_health_2026")?.coverKey).toBe(null);
  });

  it("sets the festival gallery in docx order, with the docx captions", () => {
    const pictures = byId
      .get("art_shunkhlai_festival_2026")!
      .body.content.filter((block) => block.type === "image");

    expect(pictures.map((block) => block.type === "image" && block.attrs.title)).toEqual([
      "Фестивалийн нийт уур амьсгал, тайз, олон ажилтан",
      "Спорт, үзүүлбэр, багийн үйл ажиллагаанд оролцож буй ажилтнууд",
      "Хамт олны инээмсэглэл, баярын онцлох мөч",
    ]);
    for (const block of pictures) {
      expect(block.type === "image" && block.attrs.alt.length > 0).toBe(true);
    }
  });

  it("interleaves a two-paragraph body: picture, paragraph, then the rest", () => {
    expect(
      byId
        .get("art_state_awards_2026")!
        .body.content.map((block) => block.type),
    ).toEqual(["paragraph", "image", "paragraph", "image", "image"]);
  });

  it("keeps the ISO article on 30 June 2026", () => {
    expect(byId.get("art_iso_certification_2026")?.publishedAt).toBe("2026-06-30");
  });

  it("gives the lead to exactly one story — the first the source marks", () => {
    expect(articles.filter((article) => article.featured).map((article) => article.id)).toEqual([
      "art_shunkhlai_festival_2026",
    ]);
  });

  it("publishes every article with the source's own cover alt", () => {
    for (const article of articles) {
      expect(article.status, article.id).toBe("published");
      expect(article.coverAlt.length > 0, article.id).toBe(true);
    }
  });
});
