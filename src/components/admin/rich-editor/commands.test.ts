import { describe, expect, it } from "vitest";

import { sanitizeDoc } from "@/lib/news/shared/rich-text";

import {
  clearFormatting,
  deleteSelection,
  insertBlock,
  imageBlock,
  dividerBlock,
  joinBackward,
  removeTopBlock,
  setBlockType,
  setLink,
  splitBlock,
  toggleList,
  toggleMark,
  toggleQuote,
  insertBlocks,
  insertInlines,
  linkAt,
} from "./commands";
import { activeState, cleanForSave, textblockPaths } from "./model";
import { at, doc, h, hr, img, ol, p, quote, range, shape, t, texts, ul } from "./testing";

/** Whatever a command returns must still be a document the sanitiser leaves alone. */
function stable<T extends { doc: ReturnType<typeof doc> }>(change: T | null): T {
  expect(change).not.toBeNull();
  expect(sanitizeDoc(change!.doc)).toEqual(change!.doc);
  return change!;
}

describe("toggleMark", () => {
  it("bolds a range and leaves the rest alone", () => {
    const { doc: out } = stable(toggleMark(doc(p("hello world")), range([0, 0], [0, 5]), "bold"));
    expect(out.content[0]).toEqual({
      type: "paragraph",
      content: [t("hello", { type: "bold" }), t(" world")],
    });
  });

  it("removes the mark when the whole range already has it", () => {
    const bold = doc(p(t("hello", { type: "bold" }), " world"));
    const { doc: out } = stable(toggleMark(bold, range([0, 0], [0, 5]), "bold"));
    expect(out.content[0]).toEqual({ type: "paragraph", content: [t("hello world")] });
  });

  it("adds the mark when only part of the range has it", () => {
    const mixed = doc(p(t("ab", { type: "italic" }), "cd"));
    const { doc: out } = stable(toggleMark(mixed, range([0, 0], [0, 4]), "italic"));
    expect(out.content[0]).toEqual({ type: "paragraph", content: [t("abcd", { type: "italic" })] });
  });

  it("works across paragraphs", () => {
    const { doc: out } = stable(toggleMark(doc(p("one"), p("two")), range([0, 1], [1, 2]), "underline"));
    expect(JSON.stringify(out)).toContain('"underline"');
    expect(texts(out)).toEqual(["one", "two"]);
  });

  it("with a bare caret marks the word around it", () => {
    const { doc: out } = stable(toggleMark(doc(p("say hello now")), at(0, 6), "bold"));
    expect(out.content[0]).toEqual({
      type: "paragraph",
      content: [t("say "), t("hello", { type: "bold" }), t(" now")],
    });
  });

  it("does nothing for a caret with no word", () => {
    expect(toggleMark(doc(p("a  b")), at(0, 2), "bold")).toBeNull();
  });

  it("applies more than one mark to the same run", () => {
    const first = stable(toggleMark(doc(p("word")), range([0, 0], [0, 4]), "bold"));
    const second = stable(toggleMark(first.doc, range([0, 0], [0, 4]), "italic"));
    const run = (second.doc.content[0] as { content: Array<{ marks: Array<{ type: string }> }> }).content[0];
    expect(run.marks.map((m) => m.type).sort()).toEqual(["bold", "italic"]);
  });
});

describe("links", () => {
  const link = { href: "https://shunkhlai.mn/", target: null } as const;

  it("links a selection", () => {
    const { doc: out } = stable(setLink(doc(p("visit us today")), range([0, 6], [0, 8]), link));
    expect(out.content[0]).toEqual({
      type: "paragraph",
      content: [t("visit "), t("us", { type: "link", attrs: link }), t(" today")],
    });
  });

  it("finds and removes the whole link from a caret inside it", () => {
    const linked = doc(p(t("visit "), t("our site", { type: "link", attrs: link })));
    expect(linkAt(linked, { tb: 0, off: 9 })).toEqual(link);
    const { doc: out } = stable(setLink(linked, at(0, 9), null));
    expect(out.content[0]).toEqual({ type: "paragraph", content: [t("visit our site")] });
  });

  it("edits the target of an existing link from a caret", () => {
    const linked = doc(p(t("site", { type: "link", attrs: link })));
    const other = { href: "https://example.com/", target: "_blank" } as const;
    const { doc: out } = stable(setLink(linked, at(0, 2), other));
    expect(JSON.stringify(out)).toContain("example.com");
    expect(JSON.stringify(out)).not.toContain("shunkhlai.mn");
  });

  it("inserts the address as text for a caret outside any link", () => {
    const { doc: out, sel } = stable(setLink(doc(p("see ")), at(0, 4), link));
    expect(texts(out)).toEqual(["see shunkhlai.mn/"]);
    expect(sel.focus).toEqual({ tb: 0, off: 17 });
  });

  it("reports the link and marks in the active state", () => {
    const linked = doc(p(t("site", { type: "link", attrs: link }, { type: "bold" })));
    const state = activeState(linked, range([0, 0], [0, 4]));
    expect(state.link).toEqual(link);
    expect(state.marks.has("bold")).toBe(true);
    expect(state.marks.has("italic")).toBe(false);
  });
});

describe("setBlockType", () => {
  it("turns a paragraph into each heading level and back", () => {
    for (const level of [1, 2, 3] as const) {
      const { doc: out } = stable(setBlockType(doc(p("Title")), at(0, 0), level));
      expect(out.content[0]).toMatchObject({ type: "heading", attrs: { level } });
    }
    const back = stable(setBlockType(doc(h(2, "Title")), at(0, 0), 0));
    expect(back.doc.content[0]).toMatchObject({ type: "paragraph" });
  });

  it("does not put a heading inside a list", () => {
    expect(setBlockType(doc(ul("a")), at(0, 0), 1)).toBeNull();
  });

  it("reports the heading level for the toolbar", () => {
    expect(activeState(doc(h(3, "x")), at(0, 0)).heading).toBe(3);
    expect(activeState(doc(p("x")), at(0, 0)).heading).toBe(0);
    expect(activeState(doc(ul("x")), at(0, 0)).canHeading).toBe(false);
  });
});

describe("lists and quotes", () => {
  it("wraps paragraphs in a bullet list, one item each", () => {
    const { doc: out } = stable(toggleList(doc(p("a"), p("b"), p("c")), range([0, 0], [1, 0]), "bulletList"));
    expect(shape(out)).toEqual(["bulletList", "paragraph"]);
    expect(texts(out)).toEqual(["a", "b", "c"]);
  });

  it("takes a list back to paragraphs when toggled again", () => {
    const { doc: out } = stable(toggleList(doc(ul("a", "b")), at(0, 0), "bulletList"));
    expect(shape(out)).toEqual(["paragraph", "paragraph"]);
  });

  it("changes the kind of a list", () => {
    const { doc: out } = stable(toggleList(doc(ul("a", "b")), at(0, 0), "orderedList"));
    expect(shape(out)).toEqual(["orderedList"]);
    expect(texts(out)).toEqual(["a", "b"]);
  });

  it("reports the list kind", () => {
    expect(activeState(doc(ol("a")), at(0, 0)).list).toBe("orderedList");
  });

  it("wraps and unwraps a quote", () => {
    const wrapped = stable(toggleQuote(doc(p("a"), p("b")), range([0, 0], [1, 0])));
    expect(shape(wrapped.doc)).toEqual(["blockquote"]);
    expect(activeState(wrapped.doc, at(0, 0)).quote).toBe(true);
    const back = stable(toggleQuote(wrapped.doc, at(0, 0)));
    expect(shape(back.doc)).toEqual(["paragraph", "paragraph"]);
  });

  it("keeps a picture out of a quote", () => {
    const { doc: out } = stable(toggleQuote(doc(p("a"), img(), p("b")), range([0, 0], [1, 0])));
    expect(shape(out)).toEqual(["blockquote", "image", "blockquote"]);
  });
});

describe("insertBlock", () => {
  it("replaces an empty paragraph with the rule and leaves a caret line after it", () => {
    const { doc: out, sel } = stable(insertBlock(doc(p("a"), p()), at(1, 0), dividerBlock()));
    expect(shape(out)).toEqual(["paragraph", "horizontalRule", "paragraph"]);
    expect(sel.focus).toEqual({ tb: 1, off: 0 });
  });

  it("inserts after a filled paragraph and reuses the next paragraph as the caret line", () => {
    const picture = imageBlock({ src: "https://e.com/x.png", alt: "x", title: "cap", width: null, height: null });
    const { doc: out, sel } = stable(insertBlock(doc(p("a"), p("b")), at(0, 1), picture));
    expect(shape(out)).toEqual(["paragraph", "image", "paragraph"]);
    expect(sel.focus).toEqual({ tb: 1, off: 0 });
  });

  it("never leaves the document ending on a picture", () => {
    const { doc: out } = stable(insertBlock(doc(p("a")), at(0, 1), dividerBlock()));
    expect(out.content[out.content.length - 1].type).toBe("paragraph");
  });

  it("removes a top-level rule", () => {
    const { doc: out } = stable(removeTopBlock(doc(p("a"), hr(), p("b")), at(1, 0), 1));
    expect(shape(out)).toEqual(["paragraph", "paragraph"]);
  });
});

describe("clearFormatting", () => {
  it("strips marks from the selection and flattens a heading", () => {
    const styled = doc({
      type: "heading",
      attrs: { level: 2 },
      content: [t("Big", { type: "bold" }), t(" news", { type: "italic" })],
    });
    const { doc: out } = stable(clearFormatting(styled, range([0, 0], [0, 8])));
    expect(out.content[0]).toEqual({ type: "paragraph", content: [t("Big news")] });
  });

  it("clears the whole block at a caret", () => {
    const { doc: out } = stable(clearFormatting(doc(p(t("a", { type: "bold" }), t("b", { type: "italic" }))), at(0, 1)));
    expect(JSON.stringify(out)).not.toContain("marks");
  });
});

describe("Enter (splitBlock)", () => {
  it("splits a paragraph at the caret", () => {
    const { doc: out, sel } = stable(splitBlock(doc(p("hello")), at(0, 2)));
    expect(texts(out)).toEqual(["he", "llo"]);
    expect(sel.focus).toEqual({ tb: 1, off: 0 });
  });

  it("keeps marks on both halves", () => {
    const { doc: out } = stable(splitBlock(doc(p(t("abcd", { type: "bold" }))), at(0, 2)));
    expect(JSON.stringify(out)).toContain('"bold"');
    expect(texts(out)).toEqual(["ab", "cd"]);
  });

  it("starts a plain paragraph after a heading when Enter is pressed at its end", () => {
    const { doc: out } = stable(splitBlock(doc(h(1, "Title")), at(0, 5)));
    expect(shape(out)).toEqual(["heading", "paragraph"]);
  });

  it("keeps the heading on both halves when split in the middle", () => {
    const { doc: out } = stable(splitBlock(doc(h(2, "Title")), at(0, 2)));
    expect(shape(out)).toEqual(["heading", "heading"]);
  });

  it("turns an empty heading into a paragraph", () => {
    const { doc: out } = stable(splitBlock(doc({ type: "heading", attrs: { level: 2 } }), at(0, 0)));
    expect(shape(out)).toEqual(["paragraph"]);
  });

  it("adds a list item", () => {
    const { doc: out, sel } = stable(splitBlock(doc(ul("ab")), at(0, 1)));
    expect(shape(out)).toEqual(["bulletList"]);
    expect(texts(out)).toEqual(["a", "b"]);
    expect(sel.focus).toEqual({ tb: 1, off: 0 });
  });

  it("leaves the list when Enter is pressed on an empty item, splitting it in two", () => {
    const list = doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [p("a")] },
        { type: "listItem", content: [p()] },
        { type: "listItem", content: [p("c")] },
      ],
    });
    const { doc: out, sel } = stable(splitBlock(list, at(1, 0)));
    expect(shape(out)).toEqual(["bulletList", "paragraph", "bulletList"]);
    expect(sel.focus).toEqual({ tb: 1, off: 0 });
  });

  it("leaves a quote on an empty line", () => {
    const { doc: out } = stable(splitBlock(doc({ type: "blockquote", content: [p("a"), p()] }), at(1, 0)));
    expect(shape(out)).toEqual(["blockquote", "paragraph"]);
  });

  it("adds a line inside a quote otherwise", () => {
    const { doc: out } = stable(splitBlock(doc(quote("ab")), at(0, 1)));
    expect(shape(out)).toEqual(["blockquote"]);
    expect(texts(out)).toEqual(["a", "b"]);
  });

  it("deletes a selection first", () => {
    const { doc: out } = stable(splitBlock(doc(p("hello world")), range([0, 2], [0, 8])));
    expect(texts(out)).toEqual(["he", "rld"]);
  });
});

describe("Backspace at the start (joinBackward)", () => {
  it("joins with the previous paragraph and lands the caret at the seam", () => {
    const { doc: out, sel } = stable(joinBackward(doc(p("ab"), p("cd")), at(1, 0)));
    expect(texts(out)).toEqual(["abcd"]);
    expect(sel.focus).toEqual({ tb: 0, off: 2 });
  });

  it("does nothing at the start of the document", () => {
    expect(joinBackward(doc(p("ab")), at(0, 0))).toBeNull();
  });

  it("turns a heading into a paragraph first", () => {
    const { doc: out } = stable(joinBackward(doc(p("a"), h(2, "Title")), at(1, 0)));
    expect(shape(out)).toEqual(["paragraph", "paragraph"]);
  });

  it("takes a list item out of its list", () => {
    const { doc: out } = stable(joinBackward(doc(ul("a", "b")), at(1, 0)));
    expect(shape(out)).toEqual(["bulletList", "paragraph"]);
  });

  it("takes the first line out of a quote", () => {
    const { doc: out } = stable(joinBackward(doc(quote("a")), at(0, 0)));
    expect(shape(out)).toEqual(["paragraph"]);
  });

  it("joins a later quote line with the one above it", () => {
    const { doc: out } = stable(joinBackward(doc(quote("a", "b")), at(1, 0)));
    expect(texts(out)).toEqual(["ab"]);
    expect(shape(out)).toEqual(["blockquote"]);
  });

  it("removes a rule that sits above the caret", () => {
    const { doc: out } = stable(joinBackward(doc(p("a"), hr(), p("b")), at(1, 0)));
    expect(shape(out)).toEqual(["paragraph", "paragraph"]);
  });

  it("merges a paragraph into the last item of a list above it", () => {
    const { doc: out } = stable(joinBackward(doc(ul("a"), p("b")), at(1, 0)));
    expect(shape(out)).toEqual(["bulletList"]);
    expect(texts(out)).toEqual(["ab"]);
  });
});

describe("deleteSelection", () => {
  it("joins the two ends of a range that spans blocks and drops what is between", () => {
    const { doc: out, sel } = stable(deleteSelection(doc(p("hello"), p("middle"), p("world")), range([0, 2], [2, 3])));
    expect(texts(out)).toEqual(["held"]);
    expect(sel.focus).toEqual({ tb: 0, off: 2 });
  });

  it("removes emptied list items and their list", () => {
    const { doc: out } = stable(deleteSelection(doc(p("x"), ul("a", "b")), range([0, 1], [2, 1])));
    expect(shape(out)).toEqual(["paragraph"]);
    expect(texts(out)).toEqual(["x"]);
  });
});

describe("insertion", () => {
  it("puts inline content at the caret", () => {
    const { doc: out, sel } = stable(insertInlines(doc(p("ad")), at(0, 1), [t("bc", { type: "bold" })]));
    expect(texts(out)).toEqual(["abcd"]);
    expect(sel.focus).toEqual({ tb: 0, off: 3 });
  });

  it("splits the block around pasted blocks", () => {
    const { doc: out, sel } = stable(insertBlocks(doc(p("ab")), at(0, 1), [h(2, "New"), p("body")]));
    expect(shape(out)).toEqual(["paragraph", "heading", "paragraph", "paragraph"]);
    expect(texts(out)).toEqual(["a", "New", "body", "b"]);
    expect(sel.focus).toEqual({ tb: 2, off: 4 });
  });

  it("replaces an empty paragraph with pasted blocks", () => {
    const { doc: out } = stable(insertBlocks(doc(p()), at(0, 0), [ul("a", "b")]));
    expect(shape(out)).toEqual(["bulletList"]);
  });
});

describe("cleanForSave", () => {
  it("drops the trailing empty paragraphs the editor keeps to type into", () => {
    expect(cleanForSave(doc(p("a"), p(), p())).content).toEqual([p("a")]);
    expect(cleanForSave(doc(p())).content).toEqual([p()]);
  });

  it("keeps blank lines in the middle", () => {
    expect(cleanForSave(doc(p("a"), p(), p("b"))).content).toHaveLength(3);
  });
});

describe("textblock order", () => {
  it("counts depth-first through lists and quotes", () => {
    const paths = textblockPaths(doc(p("a"), ul("b", "c"), quote("d"), p("e")));
    expect(paths).toHaveLength(5);
    expect(paths[1]).toEqual([1, 0, 0]);
  });
});
