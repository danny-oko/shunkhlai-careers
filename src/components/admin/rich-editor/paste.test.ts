// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { clipboardToDoc, looksLikeMarkdown, parseInlineMarkdown, pasteInto, textToDoc } from "./paste";
import { at, doc, p, shape, t, texts } from "./testing";

describe("looksLikeMarkdown", () => {
  it("recognises block markers, bold and links", () => {
    for (const text of ["# Head", "- a\n- b", "1. one", "> quote", "---", "so **bold** here", "[x](https://a.mn)"]) {
      expect(looksLikeMarkdown(text), text).toBe(true);
    }
  });

  it("leaves ordinary prose alone", () => {
    for (const text of ["Just a sentence.", "a - b", "2 * 3 = 6", "Дугаар 1. нь", "line one\nline two"]) {
      expect(looksLikeMarkdown(text), text).toBe(false);
    }
  });
});

describe("textToDoc", () => {
  it("turns markdown structure into blocks with no markers left", () => {
    const out = textToDoc(
      "# Title\n\nIntro with **bold** and *soft* and [a link](https://shunkhlai.mn).\n\n- one\n- two\n\n1. first\n2. second\n\n> wise words\n\n---\n\n### Minor",
    );
    expect(shape(out)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "blockquote",
      "horizontalRule",
      "heading",
    ]);
    expect(texts(out)).toEqual(["Title", "Intro with bold and soft and a link.", "one", "two", "first", "second", "wise words", "Minor"]);
    expect(JSON.stringify(out)).not.toMatch(/\*|#|\]\(|"> |---/u);
    expect(JSON.stringify(out)).toContain('"bold"');
    expect(JSON.stringify(out)).toContain('"italic"');
    expect(JSON.stringify(out)).toContain("https://shunkhlai.mn/");
  });

  it("maps deeper heading levels down to three", () => {
    expect(textToDoc("###### deep").content[0]).toMatchObject({ type: "heading", attrs: { level: 3 } });
  });

  it("keeps numbering that does not start at one", () => {
    expect(textToDoc("3. c\n4. d").content[0]).toMatchObject({ type: "orderedList", attrs: { start: 3 } });
  });

  it("splits paragraphs on blank lines and keeps single newlines as line breaks", () => {
    const out = textToDoc("a\nb\n\nc");
    expect(out.content).toHaveLength(2);
    expect(out.content[0]).toEqual({
      type: "paragraph",
      content: [t("a"), { type: "hardBreak" }, t("b")],
    });
  });

  it("does not read markdown into plain prose", () => {
    const out = textToDoc("2 * 3 * 4 is 24 and a_b_c stays");
    expect(texts(out)).toEqual(["2 * 3 * 4 is 24 and a_b_c stays"]);
  });

  it("drops an unsafe markdown link target but keeps the words", () => {
    const out = textToDoc("- [click](javascript:alert(1))");
    expect(JSON.stringify(out)).not.toContain("javascript");
    expect(texts(out)).toEqual(["click"]);
  });

  it("nests inline marks", () => {
    expect(parseInlineMarkdown("**a *b* c**")).toEqual([
      t("a ", { type: "bold" }),
      t("b", { type: "bold" }, { type: "italic" }),
      t(" c", { type: "bold" }),
    ]);
  });

  it("leaves an unclosed delimiter as written", () => {
    expect(texts(textToDoc("# a **b"))).toEqual(["a **b"]);
  });
});

describe("clipboardToDoc", () => {
  it("prefers HTML structure", () => {
    const out = clipboardToDoc({ html: "<h2>Head</h2><p>body</p>", text: "Head\nbody" });
    expect(shape(out)).toEqual(["heading", "paragraph"]);
  });

  it("falls back to text, reading markdown", () => {
    expect(shape(clipboardToDoc({ text: "## Head\n\n- a" }))).toEqual(["heading", "bulletList"]);
  });

  it("reads markdown source that arrived wrapped in unstyled HTML (an editor's copy)", () => {
    const out = clipboardToDoc({
      html: "<div><span>## Head</span><br><span>- item</span></div>",
      text: "## Head\n- item",
    });
    expect(shape(out)).toEqual(["heading", "bulletList"]);
    expect(JSON.stringify(out)).not.toContain("#");
  });

  it("returns a blank document for an empty clipboard", () => {
    expect(texts(clipboardToDoc({ html: "", text: "" }))).toEqual([""]);
  });
});

describe("pasteInto", () => {
  it("merges a single pasted line into the current one", () => {
    const { doc: out, sel } = pasteInto(doc(p("ad")), at(0, 1), textToDoc("bc"));
    expect(texts(out)).toEqual(["abcd"]);
    expect(sel.focus).toEqual({ tb: 0, off: 3 });
  });

  it("splits the line around pasted blocks", () => {
    const { doc: out } = pasteInto(doc(p("ab")), at(0, 1), textToDoc("# T\n\nbody"));
    expect(shape(out)).toEqual(["paragraph", "heading", "paragraph", "paragraph"]);
  });

  it("ignores an empty paste", () => {
    const start = doc(p("ab"));
    expect(pasteInto(start, at(0, 1), textToDoc("")).doc).toEqual(start);
  });
});
