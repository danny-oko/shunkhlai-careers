import { describe, expect, it } from "vitest";

import { formDocument } from "./form";
import { heroSchema } from "./schema";

/**
 * The form posts flat, indexed names (`slides.0.caption`) and the schema wants
 * a nested document. This is the conversion, and the two cases worth pinning
 * down are the ones a list in a browser produces: a row removed in the middle,
 * which leaves a gap in the indices, and a row an admin cleared instead of
 * removing, which must count as deleted rather than as three blank required
 * fields.
 */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const CTAS = {
  "primaryCta.label": "нээлттэй ажлын байр",
  "primaryCta.href": "/careers",
  "secondaryCta.label": "Бидний тухай",
  "secondaryCta.href": "/about",
};

describe("formDocument — hero", () => {
  it("builds the nested document the schema expects", () => {
    const document = formDocument(
      "hero",
      form({
        heading: "Хүчирхэг монголын хөгжлийн хүрд",
        "slides.0.src": "/brand/kv-amjilt.jpg",
        "slides.0.caption": "Тээвэр",
        "slides.0.alt": "Тайлбар",
        ...CTAS,
      }),
    );

    expect(heroSchema.parse(document)).toEqual({
      heading: "Хүчирхэг монголын хөгжлийн хүрд",
      slides: [{ src: "/brand/kv-amjilt.jpg", caption: "Тээвэр", alt: "Тайлбар" }],
      primaryCta: { label: "нээлттэй ажлын байр", href: "/careers" },
      secondaryCta: { label: "Бидний тухай", href: "/about" },
    });
  });

  it("keeps the order and closes the gap a removed row leaves", () => {
    const document = formDocument(
      "hero",
      form({
        heading: "Гарчиг",
        "slides.0.src": "/a.jpg",
        "slides.0.caption": "нэг",
        "slides.0.alt": "нэг",
        // index 1 was removed in the browser
        "slides.2.src": "/c.jpg",
        "slides.2.caption": "гурав",
        "slides.2.alt": "гурав",
        ...CTAS,
      }),
    ) as { slides: Array<{ caption: string }> };

    expect(document.slides.map((slide) => slide.caption)).toEqual(["нэг", "гурав"]);
  });

  it("drops a row whose every field was cleared", () => {
    const document = formDocument(
      "hero",
      form({
        heading: "Гарчиг",
        "slides.0.src": "/a.jpg",
        "slides.0.caption": "нэг",
        "slides.0.alt": "нэг",
        "slides.1.src": "  ",
        "slides.1.caption": "",
        "slides.1.alt": "",
        ...CTAS,
      }),
    ) as { slides: unknown[] };

    expect(document.slides).toHaveLength(1);
  });

  it("does not trim or default — that is the schema's job alone", () => {
    const document = formDocument("hero", form({ heading: "  Гарчиг  ", ...CTAS })) as {
      heading: string;
      slides: unknown[];
    };
    expect(document.heading).toBe("  Гарчиг  ");
    expect(document.slides).toEqual([]);
  });
});

describe("formDocument — footer and about_stats", () => {
  it("reads the contact rows in order", () => {
    const document = formDocument(
      "footer",
      form({
        address: "Капитал Хаус",
        addressUrl: "",
        "contacts.0.label": "Утас",
        "contacts.0.value": "9669-6229",
        "contacts.0.href": "tel:+97696696229",
        "contacts.1.label": "И-мэйл",
        "contacts.1.value": "hr@shunkhlai.mn",
        "contacts.1.href": "mailto:hr@shunkhlai.mn",
      }),
    ) as { contacts: Array<{ label: string }> };

    expect(document.contacts.map((row) => row.label)).toEqual(["Утас", "И-мэйл"]);
  });

  it("reads the figures in order", () => {
    const document = formDocument(
      "about_stats",
      form({
        heading: "Хөгжил тоон үзүүлэлтээр · 2026",
        "items.0.value": "10,029",
        "items.0.label": "хамрагдалт",
        "items.1.value": "90.7%",
        "items.1.label": "үнэлгээ",
      }),
    ) as { items: Array<{ value: string }> };

    expect(document.items.map((item) => item.value)).toEqual(["10,029", "90.7%"]);
  });

  it("ignores a field name that is not one of the section's own", () => {
    const document = formDocument(
      "about_stats",
      form({ heading: "Гарчиг", "items.0.evil": "x", section: "about_stats" }),
    ) as { items: unknown[] };

    expect(document.items).toEqual([]);
  });
});

describe("formDocument — culture", () => {
  const labels = {
    heading: "Бидэнтэй нэгдсэнээр та",
    "walls.academy.label": "Сургалт, хөгжил",
    "walls.benefits.label": "Хөнгөлөлт, хангамж",
    "walls.clubs.label": "Хобби клубууд",
  };

  it("reads tiles and their photographs in index order, gaps and all", () => {
    const document = formDocument(
      "culture",
      form({
        ...labels,
        "walls.academy.items.2.title": "Хоёр дахь",
        "walls.academy.items.2.images.0": "/b.jpg",
        "walls.academy.items.0.title": "Эхний",
        "walls.academy.items.0.body": "Тайлбар",
        "walls.academy.items.0.images.3": "/a-2.jpg",
        "walls.academy.items.0.images.1": "/a-1.jpg",
        "walls.academy.items.0.images.2": "",
      }),
    ) as { walls: Record<string, { label: string; items: unknown[] }> };

    expect(document.walls.academy.items).toEqual([
      { title: "Эхний", subtitle: "", body: "Тайлбар", images: ["/a-1.jpg", "/a-2.jpg"], logo: "" },
      { title: "Хоёр дахь", subtitle: "", body: "", images: ["/b.jpg"], logo: "" },
    ]);
    expect(document.walls.benefits).toEqual({ label: "Хөнгөлөлт, хангамж", items: [] });
  });

  it("drops a tile left entirely blank rather than refusing the save", () => {
    const document = formDocument(
      "culture",
      form({
        ...labels,
        "walls.clubs.items.0.title": "Спорт клуб",
        "walls.clubs.items.0.logo": "/clubs/sport.png",
        "walls.clubs.items.1.title": " ",
        "walls.clubs.items.1.images.0": "",
      }),
    ) as { walls: Record<string, { items: unknown[] }> };

    expect(document.walls.clubs.items).toHaveLength(1);
  });

  it("does not let one wall's tiles leak into another's", () => {
    const document = formDocument(
      "culture",
      form({ ...labels, "walls.benefits.items.0.title": "Спорт", "walls.benefits.items.0.images.0": "/s.jpg" }),
    ) as { walls: Record<string, { items: unknown[] }> };

    expect(document.walls.academy.items).toEqual([]);
    expect(document.walls.benefits.items).toHaveLength(1);
  });
});
