import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "./slug";

/**
 * The slug is the article's permanent URL. A transliteration hole does not
 * throw — it silently drops a letter, so two different headlines collapse onto
 * the same path and one of them becomes unreachable. These cases walk the whole
 * Mongolian Cyrillic alphabet for that reason, not for coverage's sake.
 */

/** Every letter the transliterator has to answer for, paired with its latin. */
const ALPHABET: ReadonlyArray<readonly [string, string]> = [
  ["А", "a"],
  ["Б", "b"],
  ["В", "v"],
  ["Г", "g"],
  ["Д", "d"],
  ["Е", "e"],
  ["Ё", "yo"],
  ["Ж", "j"],
  ["З", "z"],
  ["И", "i"],
  ["Й", "i"],
  ["К", "k"],
  ["Л", "l"],
  ["М", "m"],
  ["Н", "n"],
  ["О", "o"],
  ["Ө", "o"],
  ["П", "p"],
  ["Р", "r"],
  ["С", "s"],
  ["Т", "t"],
  ["У", "u"],
  ["Ү", "u"],
  ["Ф", "f"],
  ["Х", "h"],
  ["Ц", "ts"],
  ["Ч", "ch"],
  ["Ш", "sh"],
  ["Щ", "sch"],
  ["Ы", "y"],
  ["Э", "e"],
  ["Ю", "yu"],
  ["Я", "ya"],
];

describe("slugify — alphabet coverage", () => {
  for (const [upper, latin] of ALPHABET) {
    const lower = upper.toLocaleLowerCase("mn-MN");

    it(`maps ${upper}/${lower} to "${latin}"`, () => {
      expect(slugify(upper)).toBe(latin);
      expect(slugify(lower)).toBe(latin);
    });
  }

  it("drops the hard and soft signs rather than inventing a letter", () => {
    expect(slugify("Ъ")).toBe("medee");
    expect(slugify("ь")).toBe("medee");
    expect(slugify("Батъ")).toBe("bat");
  });

  it("keeps Ө and Ү distinct from О and У only in the source, not the slug", () => {
    // Both fold to the same latin vowel on purpose — the URL is ASCII. What
    // matters is that neither is dropped, which would shorten the word.
    expect(slugify("өнөөдөр")).toBe("onoodor");
    expect(slugify("үйлдвэр")).toBe("uildver");
  });
});

describe("slugify", () => {
  it("transliterates a real headline", () => {
    expect(slugify("Шунхлай Групп шинэ терминал нээлээ")).toBe(
      "shunhlai-grupp-shine-terminal-neelee",
    );
  });

  it("lowercases latin input and dash-joins words", () => {
    expect(slugify("Shunkhlai Trade AND Services")).toBe("shunkhlai-trade-and-services");
  });

  it("collapses runs of separators instead of leaving empty segments", () => {
    expect(slugify("Мэдээ   ---  шинэ")).toBe("medee-shine");
  });

  it("never starts or ends with a dash", () => {
    const slug = slugify("  — Мэдээ, шинэ! —  ");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("keeps digits", () => {
    expect(slugify("2026 оны 9 дүгээр сарын тайлан")).toBe("2026-ony-9-dugeer-saryn-tailan");
  });

  it("caps the slug at 72 characters without a trailing dash", () => {
    const long = "Шунхлай ".repeat(40);
    const slug = slugify(long);

    expect(slug.length).toBeLessThanOrEqual(72);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to \"medee\" when nothing survives", () => {
    expect(slugify("")).toBe("medee");
    expect(slugify("   ")).toBe("medee");
    expect(slugify("!!! ??? ---")).toBe("medee");
    expect(slugify("。、！")).toBe("medee");
  });
});

describe("uniqueSlug", () => {
  it("returns the plain slug when nothing is taken", () => {
    expect(uniqueSlug("Шинэ терминал", [])).toBe("shine-terminal");
  });

  it("walks the collision chain", () => {
    const taken = ["shine-terminal", "shine-terminal-2", "shine-terminal-3"];
    expect(uniqueSlug("Шинэ терминал", taken)).toBe("shine-terminal-4");
  });

  it("only skips the suffixes that are actually taken", () => {
    // -2 free, -3 taken: the chain must not blindly count the set size.
    expect(uniqueSlug("Шинэ терминал", ["shine-terminal", "shine-terminal-3"])).toBe(
      "shine-terminal-2",
    );
  });

  it("keeps the article's own slug so an edit does not churn the URL", () => {
    expect(uniqueSlug("Шинэ терминал", ["shine-terminal"], "shine-terminal")).toBe(
      "shine-terminal",
    );
  });

  it("still moves off a slug owned by someone else", () => {
    expect(uniqueSlug("Шинэ терминал", ["shine-terminal"], "ondor-slug")).toBe(
      "shine-terminal-2",
    );
  });

  it("accepts any iterable, not just an array", () => {
    expect(uniqueSlug("Шинэ терминал", new Set(["shine-terminal"]))).toBe("shine-terminal-2");
  });

  it("uniquifies the fallback slug too", () => {
    expect(uniqueSlug("!!!", ["medee"])).toBe("medee-2");
  });
});
