import { describe, expect, it } from "vitest";

import { blocksToDoc, bodyFromField, coerceBody, isLegacyBody, plainTextToDoc } from "./legacy";
import { docText, sanitizeDoc } from "./shared/rich-text";
import type { NewsBlock } from "./types";

const BLOCKS: NewsBlock[] = [
  { kind: "paragraph", text: "Эхний догол мөр." },
  { kind: "heading", text: "Дэд гарчиг" },
  { kind: "list", items: ["нэг", "хоёр"] },
  { kind: "quote", text: "Ишлэл", attribution: "Б. Энхжаргал" },
  { kind: "quote", text: "Хаяггүй ишлэл", attribution: null },
];

describe("blocksToDoc", () => {
  it("converts every legacy block kind", () => {
    const doc = blocksToDoc(BLOCKS);
    expect(doc.content.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "bulletList",
      "blockquote",
      "blockquote",
    ]);
    // Level 1 renders as h2 on the page: the same heading `##` always produced.
    expect(doc.content[1]).toMatchObject({ type: "heading", attrs: { level: 1 } });
  });

  it("keeps a quote's attribution as a closing paragraph starting with an em dash", () => {
    const quote = blocksToDoc(BLOCKS).content[3];
    expect(quote).toEqual({
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Ишлэл" }] },
        { type: "paragraph", content: [{ type: "text", text: "— Б. Энхжаргал" }] },
      ],
    });
  });

  it("puts each list item in its own item", () => {
    const list = blocksToDoc(BLOCKS).content[2];
    expect(list.type === "bulletList" && list.content).toHaveLength(2);
  });

  it("loses no words", () => {
    const text = docText(blocksToDoc(BLOCKS));
    for (const word of ["Эхний", "Дэд гарчиг", "нэг", "хоёр", "Ишлэл", "Б. Энхжаргал", "Хаяггүй"]) {
      expect(text).toContain(word);
    }
  });

  it("produces a document the sanitiser leaves untouched", () => {
    const doc = blocksToDoc(BLOCKS);
    expect(sanitizeDoc(doc)).toEqual(doc);
  });

  it("drops empty blocks and never returns an empty document", () => {
    expect(blocksToDoc([{ kind: "paragraph", text: "  " }, { kind: "list", items: ["", " "] }]).content).toEqual([
      { type: "paragraph" },
    ]);
    expect(blocksToDoc([]).content).toEqual([{ type: "paragraph" }]);
  });

  it("survives malformed entries", () => {
    const junk = [null, 4, { kind: "nope" }, { kind: "list" }, { kind: "heading" }] as unknown as NewsBlock[];
    expect(() => blocksToDoc(junk)).not.toThrow();
  });

  it("does not turn markup in old text into markup", () => {
    const doc = blocksToDoc([{ kind: "paragraph", text: "<script>alert(1)</script> **not bold**" }]);
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "<script>alert(1)</script> **not bold**" }],
    });
  });
});

describe("isLegacyBody and coerceBody", () => {
  it("recognises the old array shape and nothing else", () => {
    expect(isLegacyBody(BLOCKS)).toBe(true);
    expect(isLegacyBody([])).toBe(true);
    expect(isLegacyBody({ type: "doc", content: [] })).toBe(false);
    expect(isLegacyBody([{ type: "paragraph" }])).toBe(false);
    expect(isLegacyBody("text")).toBe(false);
    expect(isLegacyBody(null)).toBe(false);
  });

  it("loads legacy JSON off disk", () => {
    const fromDisk = JSON.parse(JSON.stringify(BLOCKS));
    expect(coerceBody(fromDisk)).toEqual(blocksToDoc(BLOCKS));
  });

  it("passes a current document through the sanitiser", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "ok" }] }] };
    expect(coerceBody(doc)).toEqual(doc);

    const hostile = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ],
    };
    expect(JSON.stringify(coerceBody(hostile))).not.toContain("javascript");
  });

  it("turns garbage into an empty document rather than throwing", () => {
    for (const value of [undefined, null, 7, "text", true]) {
      expect(coerceBody(value)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    }
  });
});

describe("the form's body field", () => {
  it("reads JSON from the editor", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H" }] }] };
    expect(bodyFromField(JSON.stringify(doc))).toEqual(doc);
  });

  it("reads anything else as blank-line separated plain text", () => {
    expect(bodyFromField("Нэг\nхоёр\n\nГурав").content).toHaveLength(2);
    expect(plainTextToDoc("a\n\n\n\nb").content).toHaveLength(2);
  });

  it("does not choke on broken JSON", () => {
    expect(() => bodyFromField('{"type": "doc", ')).not.toThrow();
    expect(docText(bodyFromField('{"type": "doc", '))).toContain("type");
  });

  it("sanitises hostile JSON", () => {
    const body = JSON.stringify({
      type: "doc",
      content: [{ type: "image", attrs: { src: "data:image/svg+xml;base64,AAAA", alt: "" } }, { type: "script" }],
    });
    expect(bodyFromField(body).content).toEqual([{ type: "paragraph" }]);
  });
});
