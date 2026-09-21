import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { blocksToDoc } from "@/lib/news/legacy";
import type { RichDoc } from "@/lib/news/shared/rich-text";

import { ArticleBody } from "./article-body";

const html = (doc: RichDoc) => renderToStaticMarkup(React.createElement(ArticleBody, { doc }));
const text = (value: string) => ({ type: "text" as const, text: value });

const DOC: RichDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [text("Title")] },
    { type: "paragraph", content: [text("Opening words")] },
    { type: "heading", attrs: { level: 2 }, content: [text("Sub")] },
    { type: "heading", attrs: { level: 3 }, content: [text("Minor")] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "bold", marks: [{ type: "bold" }, { type: "italic" }] },
        { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com/", target: "_blank" } }] },
        { type: "text", text: "same tab", marks: [{ type: "link", attrs: { href: "/careers", target: null } }] },
        { type: "hardBreak" },
        { type: "text", text: "struck", marks: [{ type: "strike" }, { type: "underline" }] },
      ],
    },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("dash item")] }] }] },
    { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("third")] }] }] },
    { type: "horizontalRule" },
    {
      type: "image",
      attrs: { src: "https://example.com/a.jpg", alt: "An alt", title: "A caption", width: null, height: null },
    },
  ],
};

describe("ArticleBody", () => {
  const out = html(DOC);

  it("renders headings one level down: h2, h3, h4", () => {
    expect(out).toMatch(/<h2[^>]*>Title<\/h2>/u);
    expect(out).toMatch(/<h3[^>]*>Sub<\/h3>/u);
    expect(out).toMatch(/<h4[^>]*>Minor<\/h4>/u);
    expect(out).not.toContain("<h1");
  });

  it("gives the first paragraph, and only it, the drop cap", () => {
    expect(out.match(/news-dropcap/gu)).toHaveLength(1);
    expect(out).toContain('<p class="news-dropcap">Opening words</p>');
  });

  it("renders marks as elements", () => {
    expect(out).toContain("<strong><em>bold</em></strong>");
    expect(out).toContain("<s><u>struck</u></s>");
    expect(out).toContain("<br/>");
  });

  it("adds rel to a link that opens a new tab, and not to one that does not", () => {
    expect(out).toMatch(/<a href="https:\/\/example.com\/" target="_blank" rel="noopener noreferrer"/u);
    const same = out.match(/<a href="\/careers"[^>]*>/u)?.[0] ?? "";
    expect(same).not.toBe("");
    expect(same).not.toContain("target");
  });

  it("renders lists, with the dash marker on bullets and the start on numbered ones", () => {
    expect(out).toMatch(/<ul[^>]*><li[^>]*>.*dash item/u);
    expect(out).toMatch(/<ol[^>]*start="3"/u);
  });

  it("renders a rule and a captioned image", () => {
    expect(out).toContain("<hr");
    expect(out).toMatch(/<img src="https:\/\/example.com\/a.jpg" alt="An alt"/u);
    expect(out).toContain("<figcaption");
    expect(out).toContain("A caption");
  });

  it("escapes text instead of passing markup through", () => {
    const evil = html({
      type: "doc",
      content: [{ type: "paragraph", content: [text("<img src=x onerror=alert(1)><script>alert(1)</script>")] }],
    });
    expect(evil).not.toContain("<script");
    expect(evil).not.toContain("<img");
    expect(evil).toContain("&lt;script&gt;");
  });

  it("sets a quote's closing em-dash paragraph as its byline", () => {
    const quoted = html(blocksToDoc([{ kind: "quote", text: "Words", attribution: "A. Speaker" }]));
    expect(quoted).toContain("<blockquote");
    expect(quoted).toMatch(/<footer[^>]*>— A. Speaker<\/footer>/u);
    expect(quoted).toMatch(/<p[^>]*>Words<\/p>/u);
  });

  it("renders a legacy body converted from blocks, look intact", () => {
    const legacy = html(
      blocksToDoc([
        { kind: "paragraph", text: "First" },
        { kind: "heading", text: "Head" },
        { kind: "list", items: ["one", "two"] },
      ]),
    );
    expect(legacy).toContain("news-dropcap");
    expect(legacy).toMatch(/<h2[^>]*>Head<\/h2>/u);
    expect(legacy.match(/<li/gu)).toHaveLength(2);
  });

  it("skips empty paragraphs rather than rendering blank ones", () => {
    const blank = html({ type: "doc", content: [{ type: "paragraph" }, { type: "paragraph", content: [text("x")] }] });
    expect(blank.match(/<p/gu)).toHaveLength(1);
  });
});
