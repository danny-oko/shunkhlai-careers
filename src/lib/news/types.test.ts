import { describe, expect, it } from "vitest";

import {
  NEWS_CATEGORIES,
  bodyExcerpt,
  categoryLabel,
  coverUrl,
  formatNewsDate,
  formatNewsDateShort,
  isNewsCategory,
  readingMinutes,
} from "./types";
import { blocksToDoc } from "./legacy";
import { emptyDoc } from "./shared/rich-text";
import type { NewsBlock, NewsCategory } from "./types";

/**
 * Dates and labels here are user-facing Mongolian copy. The month suffix obeys
 * vowel harmony, so a single wrong suffix is not a typo an English-reading
 * reviewer would catch — it is the kind of thing only a table catches.
 */

/** The suffix each month takes. Front-vowel months take дүгээр. */
const MONTH_SUFFIX: ReadonlyArray<readonly [number, string]> = [
  [1, "дүгээр"],
  [2, "дугаар"],
  [3, "дугаар"],
  [4, "дүгээр"],
  [5, "дугаар"],
  [6, "дугаар"],
  [7, "дугаар"],
  [8, "дугаар"],
  [9, "дүгээр"],
  [10, "дугаар"],
  [11, "дүгээр"],
  [12, "дугаар"],
];

describe("formatNewsDate", () => {
  for (const [month, suffix] of MONTH_SUFFIX) {
    it(`uses ${suffix} for month ${month}`, () => {
      const iso = `2026-${String(month).padStart(2, "0")}-15`;
      expect(formatNewsDate(iso)).toBe(`2026 оны ${month} ${suffix} сарын 15`);
    });
  }

  it("strips the leading zero from the day", () => {
    expect(formatNewsDate("2026-09-01")).toBe("2026 оны 9 дүгээр сарын 1");
  });

  it("does not throw on a malformed date", () => {
    expect(() => formatNewsDate("")).not.toThrow();
    expect(() => formatNewsDate("not-a-date")).not.toThrow();
    expect(() => formatNewsDate("2026-13-40")).not.toThrow();
  });
});

describe("formatNewsDateShort", () => {
  it("keeps the zero padding for a compact dateline", () => {
    expect(formatNewsDateShort("2026-09-01")).toBe("2026.09.01");
    expect(formatNewsDateShort("2026-12-25")).toBe("2026.12.25");
  });

  it("does not throw on a malformed date", () => {
    expect(() => formatNewsDateShort("")).not.toThrow();
  });
});

describe("readingMinutes", () => {
  /** `count` single-word paragraphs — the cheapest way to hit a word target. */
  function words(count: number) {
    return blocksToDoc([
      { kind: "paragraph", text: Array.from({ length: count }, () => "үг").join(" ") },
    ]);
  }

  it("floors at one minute for an empty body", () => {
    expect(readingMinutes(emptyDoc())).toBe(1);
  });

  it("floors at one minute for a body far under 180 words", () => {
    expect(readingMinutes(words(1))).toBe(1);
    expect(readingMinutes(words(179))).toBe(1);
  });

  it("is exactly one minute at 180 words", () => {
    expect(readingMinutes(words(180))).toBe(1);
  });

  it("rounds up past the boundary", () => {
    expect(readingMinutes(words(181))).toBe(2);
    expect(readingMinutes(words(360))).toBe(2);
    expect(readingMinutes(words(361))).toBe(3);
  });

  it("counts words in every block kind, not just paragraphs", () => {
    const body: NewsBlock[] = [
      { kind: "heading", text: Array.from({ length: 60 }, () => "үг").join(" ") },
      { kind: "list", items: [Array.from({ length: 60 }, () => "үг").join(" ")] },
      { kind: "quote", text: Array.from({ length: 61 }, () => "үг").join(" "), attribution: null },
    ];

    // 181 words across three kinds: a counter that only reads paragraphs would
    // answer 1 here.
    expect(readingMinutes(blocksToDoc(body))).toBe(2);
  });
});

describe("bodyExcerpt", () => {
  const blocks: NewsBlock[] = [
    { kind: "paragraph", text: "Шунхлай Групп өнөөдөр шинэ терминалаа нээлээ." },
    { kind: "heading", text: "Хүчин чадал" },
    { kind: "paragraph", text: "Терминал 12 мянган тонн хүчин чадалтай." },
  ];
  const body = blocksToDoc(blocks);

  it("returns plain text with no block syntax in it", () => {
    const excerpt = bodyExcerpt(body);

    expect(excerpt).not.toContain("##");
    expect(excerpt).not.toContain(">");
    expect(excerpt.startsWith("Шунхлай Групп")).toBe(true);
  });

  it("respects the max length", () => {
    expect(bodyExcerpt(body, 20).length).toBeLessThanOrEqual(20);
  });

  it("trims on a word boundary rather than mid-word", () => {
    const excerpt = bodyExcerpt(body, 20);
    const stripped = excerpt.replace(/[….\s]+$/u, "");

    // Whatever is kept must be a whole prefix of words from the source.
    expect("Шунхлай Групп өнөөдөр шинэ терминалаа нээлээ.").toContain(stripped);
    expect(stripped.endsWith("өнөөдө")).toBe(false);
  });

  it("does not pad or truncate a body already under the max", () => {
    expect(bodyExcerpt(blocksToDoc([{ kind: "paragraph", text: "Богино." }]), 200)).toBe("Богино.");
  });

  it("returns an empty string for an empty body", () => {
    expect(bodyExcerpt(emptyDoc())).toBe("");
    expect(bodyExcerpt(emptyDoc(), 10)).toBe("");
  });

  it("does not throw when max is smaller than the first word", () => {
    expect(() => bodyExcerpt(body, 1)).not.toThrow();
    expect(() => bodyExcerpt(body, 0)).not.toThrow();
  });
});

describe("categories", () => {
  it("lists the four categories with Mongolian labels", () => {
    expect(NEWS_CATEGORIES.map((entry) => entry.value)).toEqual([
      "company",
      "industry",
      "society",
      "people",
    ]);
    expect(NEWS_CATEGORIES.map((entry) => entry.label)).toEqual([
      "Компани",
      "Салбар",
      "Нийгэм",
      "Хүний нөөц",
    ]);
  });

  it("gives every category a non-empty English label for aria/meta use", () => {
    for (const entry of NEWS_CATEGORIES) {
      expect(entry.labelEn.length).toBeGreaterThan(0);
    }
  });

  it("resolves a label for each value", () => {
    for (const entry of NEWS_CATEGORIES) {
      expect(categoryLabel(entry.value)).toBe(entry.label);
    }
  });

  it("guards unknown values", () => {
    expect(isNewsCategory("company")).toBe(true);
    expect(isNewsCategory("COMPANY")).toBe(false);
    expect(isNewsCategory("")).toBe(false);
    expect(isNewsCategory(null)).toBe(false);
    expect(isNewsCategory(undefined)).toBe(false);
    expect(isNewsCategory(0)).toBe(false);
    expect(isNewsCategory({ value: "company" })).toBe(false);
  });

  it("narrows the type through the guard", () => {
    const value: unknown = "people";
    if (isNewsCategory(value)) {
      const narrowed: NewsCategory = value;
      expect(narrowed).toBe("people");
    } else {
      expect.unreachable("\"people\" is a category");
    }
  });
});

describe("coverUrl", () => {
  it("returns null when there is no cover", () => {
    expect(coverUrl(null)).toBe(null);
  });

  it("points at the media route", () => {
    expect(coverUrl("med_aaaabbbbcccc")).toBe("/api/news/media/med_aaaabbbbcccc");
  });

  it("encodes a seed key so the colon does not break the path", () => {
    // Seed covers use "seed:brand/mock-03.jpg"; an unencoded slash would read
    // as a second path segment and miss the route entirely.
    expect(coverUrl("seed:brand/mock-03.jpg")).toBe(
      "/api/news/media/seed%3Abrand%2Fmock-03.jpg",
    );
  });
});
