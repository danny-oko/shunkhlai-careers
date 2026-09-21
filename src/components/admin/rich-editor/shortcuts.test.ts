import { describe, expect, it } from "vitest";

import {
  applyBlockShortcut,
  applyDividerShortcut,
  applyInlineShortcut,
  clearSlash,
  filterSlashItems,
  slashQuery,
} from "./shortcuts";
import { at, doc, h, p, quote, shape, t, texts } from "./testing";

/** After a conversion none of the markers may be left in the content. */
const noMarkers = (d: unknown) => expect(JSON.stringify(d)).not.toMatch(/[#>]|\*\*|---|"- |"\* /u);

describe("block shortcuts consume their marker", () => {
  it.each([
    ["# ", 1],
    ["## ", 2],
    ["### ", 3],
  ] as const)("%j makes a level %i heading", (typed, level) => {
    const change = applyBlockShortcut(doc(p(typed)), at(0, typed.length));
    expect(change?.doc.content[0]).toMatchObject({ type: "heading", attrs: { level } });
    expect(texts(change!.doc)).toEqual([""]);
    noMarkers(change!.doc);
    expect(change!.sel.focus).toEqual({ tb: 0, off: 0 });
  });

  it.each(["- ", "* ", "+ "])("%j makes a bullet list", (typed) => {
    const change = applyBlockShortcut(doc(p(typed)), at(0, 2));
    expect(shape(change!.doc)).toEqual(["bulletList"]);
    expect(texts(change!.doc)).toEqual([""]);
  });

  it("1. makes a numbered list starting at that number", () => {
    const change = applyBlockShortcut(doc(p("3. ")), at(0, 3));
    expect(change!.doc.content[0]).toMatchObject({ type: "orderedList", attrs: { start: 3 } });
    expect(texts(change!.doc)).toEqual([""]);
  });

  it("> makes a quote", () => {
    const change = applyBlockShortcut(doc(p("> ")), at(0, 2));
    expect(shape(change!.doc)).toEqual(["blockquote"]);
    noMarkers(change!.doc);
  });

  it("keeps text that follows the marker", () => {
    // A marker typed in front of existing words converts and keeps the words.
    const typedInFront = applyBlockShortcut(doc(p("## Гарчиг")), at(0, 3));
    expect(typedInFront!.doc.content[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(texts(typedInFront!.doc)).toEqual(["Гарчиг"]);
  });

  it("does not fire mid-line, in a heading, or with a range selected", () => {
    expect(applyBlockShortcut(doc(p("a - ")), at(0, 4))).toBeNull();
    expect(applyBlockShortcut(doc(h(2, "- ")), at(0, 2))).toBeNull();
    expect(applyBlockShortcut(doc(p("- ")), { anchor: { tb: 0, off: 0 }, focus: { tb: 0, off: 2 } })).toBeNull();
    expect(applyBlockShortcut(doc(quote("- ")), at(0, 2))).toBeNull();
  });

  it("ignores a marker with no space yet, and four hashes", () => {
    expect(applyBlockShortcut(doc(p("##")), at(0, 2))).toBeNull();
    expect(applyBlockShortcut(doc(p("#### ")), at(0, 5))).toBeNull();
  });
});

describe("--- then Enter", () => {
  it("becomes a rule with a fresh paragraph, and no dashes remain", () => {
    const change = applyDividerShortcut(doc(p("before"), p("---")), at(1, 3));
    expect(shape(change!.doc)).toEqual(["paragraph", "horizontalRule", "paragraph"]);
    expect(texts(change!.doc)).toEqual(["before", ""]);
    expect(change!.sel.focus).toEqual({ tb: 1, off: 0 });
    noMarkers(change!.doc);
  });

  it("also accepts *** and ___", () => {
    expect(applyDividerShortcut(doc(p("***")), at(0, 3))).not.toBeNull();
    expect(applyDividerShortcut(doc(p("___")), at(0, 3))).not.toBeNull();
  });

  it("leaves two dashes, and dashes with words, alone", () => {
    expect(applyDividerShortcut(doc(p("--")), at(0, 2))).toBeNull();
    expect(applyDividerShortcut(doc(p("--- x")), at(0, 5))).toBeNull();
  });
});

describe("inline shortcuts", () => {
  it("**text** becomes bold on the closing delimiter, with no asterisks left", () => {
    const change = applyInlineShortcut(doc(p("say **hello**")), at(0, 13));
    expect(change!.doc.content[0]).toEqual({
      type: "paragraph",
      content: [t("say "), t("hello", { type: "bold" })],
    });
    expect(change!.sel.focus).toEqual({ tb: 0, off: 9 });
    expect(JSON.stringify(change!.doc)).not.toContain("*");
  });

  it("*text* becomes italic", () => {
    const change = applyInlineShortcut(doc(p("a *word*")), at(0, 8));
    expect(change!.doc.content[0]).toEqual({
      type: "paragraph",
      content: [t("a "), t("word", { type: "italic" })],
    });
  });

  it("~~text~~ becomes strike", () => {
    const change = applyInlineShortcut(doc(p("~~old~~")), at(0, 7));
    expect(change!.doc.content[0]).toEqual({ type: "paragraph", content: [t("old", { type: "strike" })] });
  });

  it("does not read the first half of **bold** as italic", () => {
    expect(applyInlineShortcut(doc(p("**bold*")), at(0, 7))).toBeNull();
  });

  it("does not fire on multiplication, or with spaces inside the delimiters", () => {
    expect(applyInlineShortcut(doc(p("2*3*")), at(0, 4))).toBeNull();
    expect(applyInlineShortcut(doc(p("* spaced *")), at(0, 10))).toBeNull();
  });

  it("works on Mongolian Cyrillic", () => {
    const change = applyInlineShortcut(doc(p("**Шунхлай**")), at(0, 11));
    expect(change!.doc.content[0]).toEqual({ type: "paragraph", content: [t("Шунхлай", { type: "bold" })] });
  });
});

describe("slash menu", () => {
  it("opens on a lone / at the end of a plain paragraph and carries the query", () => {
    expect(slashQuery(doc(p("/")), at(0, 1))).toEqual({ tb: 0, query: "" });
    expect(slashQuery(doc(p("/гар")), at(0, 4))).toEqual({ tb: 0, query: "гар" });
  });

  it("stays closed mid-sentence, in a heading, in a list, or after a space", () => {
    expect(slashQuery(doc(p("a /")), at(0, 3))).toBeNull();
    expect(slashQuery(doc(h(1, "/")), at(0, 1))).toBeNull();
    expect(slashQuery(doc({ type: "bulletList", content: [{ type: "listItem", content: [p("/")] }] }), at(0, 1))).toBeNull();
    expect(slashQuery(doc(p("/a b")), at(0, 4))).toBeNull();
  });

  it("filters by Mongolian label or English keyword", () => {
    expect(filterSlashItems("").length).toBe(8);
    expect(filterSlashItems("list").map((i) => i.id)).toEqual(["bullet", "numbered"]);
    expect(filterSlashItems("ишлэл").map((i) => i.id)).toEqual(["quote"]);
    expect(filterSlashItems("зураг").map((i) => i.id)).toContain("image");
    expect(filterSlashItems("zzzz")).toEqual([]);
  });

  it("clears the typed command", () => {
    expect(texts(clearSlash(doc(p("/qu")), 0))).toEqual([""]);
  });
});
