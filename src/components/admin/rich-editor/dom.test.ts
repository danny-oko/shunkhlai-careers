// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import type { RichDoc } from "@/lib/news/shared/rich-text";

import { htmlToDoc, parseDom, pointFromPos, posFromPoint, renderDoc } from "./dom";
import { contentOf, inlineLength, textblockNodes } from "./model";
import { doc, h, hr, ol, p, quote, shape, t, texts, ul } from "./testing";

function surface(html = ""): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

const IMAGE = {
  type: "image",
  attrs: { src: "https://example.com/a.jpg", alt: "alt text", title: "A caption", width: 640, height: 480 },
} as const;

const RICH: RichDoc = doc(
  h(1, "Title"),
  p("plain ", t("bold", { type: "bold" }), " ", t("both", { type: "bold" }, { type: "italic" }), " end"),
  p(t("link", { type: "link", attrs: { href: "https://shunkhlai.mn/", target: "_blank" } })),
  p(),
  { type: "paragraph", content: [t("line one"), { type: "hardBreak" }, t("line two")] },
  { type: "paragraph", content: [t("ends with a break"), { type: "hardBreak" }] },
  ul("one", "two"),
  { type: "orderedList", attrs: { start: 4 }, content: [{ type: "listItem", content: [p("four")] }] },
  quote("said", "it"),
  hr(),
  IMAGE,
  h(3, "Минор гарчиг"),
  p("Шунхлай Групп"),
);

describe("render then parse", () => {
  it("round-trips a document exactly", () => {
    const root = surface();
    renderDoc(RICH, root);
    expect(parseDom(root).doc).toEqual(RICH);
  });

  it("round-trips an empty document", () => {
    const root = surface();
    renderDoc(doc(p()), root);
    expect(parseDom(root).doc).toEqual(doc(p()));
  });

  it("renders text as text, never as markup", () => {
    const root = surface();
    renderDoc(doc(p("<img src=x onerror=alert(1)> & <b>")), root);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
    expect(root.textContent).toBe("<img src=x onerror=alert(1)> & <b>");
  });

  it("marks the picture and the rule as non-editable", () => {
    const root = surface();
    renderDoc(doc(p("a"), hr(), IMAGE, p("b")), root);
    expect(root.querySelector("hr")?.getAttribute("contenteditable")).toBe("false");
    expect(root.querySelector("figure")?.getAttribute("contenteditable")).toBe("false");
  });
});

describe("reading what the browser leaves behind", () => {
  it("treats a lone <br> as an empty line, not a line break", () => {
    const { doc: out } = parseDom(surface("<p>a</p><p><br></p><p>b</p>"));
    expect(shape(out)).toEqual(["paragraph", "paragraph", "paragraph"]);
    expect(out.content[1]).toEqual({ type: "paragraph" });
  });

  it("keeps a real Shift+Enter break", () => {
    const { doc: out } = parseDom(surface("<p>a<br>b</p>"));
    expect(out.content[0]).toEqual({ type: "paragraph", content: [t("a"), { type: "hardBreak" }, t("b")] });
  });

  it("reads bare <div> lines, which Chrome makes on Enter, as paragraphs", () => {
    const { doc: out } = parseDom(surface("<p>a</p><div>b</div><div><br></div>"));
    expect(texts(out)).toEqual(["a", "b", ""]);
  });

  it("turns a non-breaking space into a space", () => {
    expect(texts(parseDom(surface("<p>a&nbsp;b</p>")).doc)).toEqual(["a b"]);
  });

  it("reads loose text at the root as a paragraph", () => {
    expect(texts(parseDom(surface("just text")).doc)).toEqual(["just text"]);
  });

  it("merges neighbouring runs that carry the same mark", () => {
    const { doc: out } = parseDom(surface("<p><b>a</b><b>b</b></p>"), { collapse: true });
    expect(out.content[0]).toEqual({ type: "paragraph", content: [t("ab", { type: "bold" })] });
  });
});

describe("caret mapping", () => {
  it("maps every position to a DOM point and back", () => {
    const root = surface();
    renderDoc(RICH, root);
    const { leaves, doc: parsed } = parseDom(root);

    textblockNodes(parsed).forEach((node, tb) => {
      const length = inlineLength(contentOf(node));
      for (let off = 0; off <= length; off += 1) {
        const point = pointFromPos(leaves, { tb, off });
        expect(point, `tb ${tb} off ${off}`).not.toBeNull();
        expect(posFromPoint(leaves, point!.node, point!.offset)).toEqual({ tb, off });
      }
    });
  });

  it("maps an element-container point at the end of a block to that block's end", () => {
    const root = surface();
    renderDoc(doc(p("ab"), p("cd")), root);
    const { leaves } = parseDom(root);
    const first = root.children[0];
    expect(posFromPoint(leaves, first, first.childNodes.length)).toEqual({ tb: 0, off: 2 });
    expect(posFromPoint(leaves, root, 1)).toEqual({ tb: 1, off: 0 });
    expect(posFromPoint(leaves, root, 2)).toEqual({ tb: 1, off: 2 });
  });

  it("puts the caret in an empty paragraph", () => {
    const root = surface();
    renderDoc(doc(p("a"), p()), root);
    const { leaves } = parseDom(root);
    const point = pointFromPos(leaves, { tb: 1, off: 0 });
    expect(point?.node).toBe(root.children[1]);
  });

  it("counts textblocks the same way the document does, through lists and quotes", () => {
    const root = surface();
    renderDoc(doc(p("a"), ul("b", "c"), quote("d"), p("e")), root);
    const { leaves } = parseDom(root);
    expect(new Set(leaves.map((leaf) => leaf.tb)).size).toBe(5);
  });

  it("reports images and rules with their top-level index", () => {
    const root = surface();
    renderDoc(doc(p("a"), hr(), IMAGE, p("b")), root);
    expect(parseDom(root).atoms.map((atom) => atom.top)).toEqual([1, 2]);
  });
});

describe("pasted and dropped HTML", () => {
  it("keeps headings, lists, quotes and inline marks", () => {
    const out = htmlToDoc(
      "<h2>Head</h2><p>Some <strong>bold</strong> and <em>italic</em> and <u>under</u> and <s>gone</s></p>" +
        "<ul><li>a</li><li>b</li></ul><ol start=3><li>c</li></ol><blockquote><p>q</p></blockquote><hr>",
    );
    expect(shape(out)).toEqual(["heading", "paragraph", "bulletList", "orderedList", "blockquote", "horizontalRule"]);
    expect(out.content[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    const marks = JSON.stringify(out.content[1]);
    for (const type of ["bold", "italic", "underline", "strike"]) expect(marks).toContain(`"${type}"`);
    expect(out.content[3]).toMatchObject({ type: "orderedList", attrs: { start: 3 } });
  });

  it("maps h1 h2 h3 and deeper onto the three levels", () => {
    const levels = htmlToDoc("<h1>a</h1><h3>b</h3><h5>c</h5>").content.map((b) =>
      b.type === "heading" ? b.attrs.level : null,
    );
    expect(levels).toEqual([1, 3, 3]);
  });

  it("collapses source whitespace and drops empty blocks", () => {
    const out = htmlToDoc("<div>\n  <p>  hello \n  world  </p>\n  <p> </p>\n</div>");
    expect(texts(out)).toEqual(["hello world"]);
  });

  it("removes script, style and event handlers", () => {
    const out = htmlToDoc(
      '<p onclick="alert(1)" style="color:red">hi<script>alert(1)</script><style>p{}</style></p><iframe src="https://evil"></iframe>',
    );
    expect(texts(out)).toEqual(["hi"]);
    expect(JSON.stringify(out)).not.toMatch(/script|alert|onclick|iframe|style/u);
  });

  it("drops javascript: links but keeps their words", () => {
    const out = htmlToDoc('<p><a href="javascript:alert(1)">click</a> <a href="https://ok.example/">ok</a></p>');
    expect(texts(out)).toEqual(["click ok"]);
    expect(JSON.stringify(out)).not.toContain("javascript");
    expect(JSON.stringify(out)).toContain("https://ok.example/");
  });

  it("carries a link's target", () => {
    const out = htmlToDoc('<p><a href="https://x.example/" target="_blank">x</a></p>');
    expect(JSON.stringify(out)).toContain('"target":"_blank"');
  });

  it("refuses data:, http: and script images", () => {
    for (const src of ["data:image/png;base64,AAAA", "http://example.com/a.png", "javascript:alert(1)", "//evil.example/a.png"]) {
      expect(shape(htmlToDoc(`<p>x</p><img src="${src}" onerror="alert(1)">`)), src).toEqual(["paragraph"]);
    }
  });

  it("keeps an https image and its caption", () => {
    const out = htmlToDoc('<figure><img src="https://example.com/a.jpg" alt="A"><figcaption>Caption</figcaption></figure>');
    expect(out.content[0]).toMatchObject({ type: "image", attrs: { src: "https://example.com/a.jpg", alt: "A", title: "Caption" } });
  });

  it("does not trust the editor's own data-image attribute either", () => {
    const evil = JSON.stringify({ src: "javascript:alert(1)", alt: "", title: null, width: null, height: null });
    const out = htmlToDoc(`<figure data-image='${evil}'></figure><p>x</p>`);
    expect(shape(out)).toEqual(["paragraph"]);
  });

  it("reads bold from Google Docs style spans, and ignores its font-weight:normal wrapper", () => {
    const out = htmlToDoc(
      ["<b style=", '"font-weight:normal"', ' id="docs-internal-guid"><p><span style=', '"font-weight:700"', ">bold</span> and plain</p></b>"].join(""),
    );
    expect(out.content[0]).toEqual({
      type: "paragraph",
      content: [t("bold", { type: "bold" }), t(" and plain")],
    });
  });

  it("reads italic and underline from styles", () => {
    const out = htmlToDoc('<p><span style="font-style:italic;text-decoration:underline">x</span></p>');
    expect(JSON.stringify(out)).toContain('"italic"');
    expect(JSON.stringify(out)).toContain('"underline"');
  });

  it("flattens a table to its words", () => {
    const out = htmlToDoc("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>");
    expect(texts(out).join(" ")).toBe("a b c");
    expect(shape(out).every((type) => type === "paragraph")).toBe(true);
  });

  it("keeps nested lists inside their item", () => {
    const out = htmlToDoc("<ul><li>a<ul><li>b</li></ul></li></ul>");
    expect(texts(out)).toEqual(["a", "b"]);
    expect(shape(out)).toEqual(["bulletList"]);
  });

  it("does not execute or fetch anything while parsing", () => {
    (globalThis as { __ran?: boolean }).__ran = false;
    htmlToDoc('<img src="https://example.com/x.png" onerror="globalThis.__ran = true"><svg onload="globalThis.__ran = true"></svg>');
    expect((globalThis as { __ran?: boolean }).__ran).toBe(false);
  });
});

describe("ordered list numbering", () => {
  it("survives a round trip", () => {
    const root = surface();
    renderDoc(doc(ol("a")), root);
    expect(root.querySelector("ol")?.getAttribute("start")).toBeNull();
    expect(parseDom(root).doc.content[0]).toMatchObject({ attrs: { start: 1 } });
  });
});
