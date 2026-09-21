import type { BlockNode, InlineNode, Mark, RichDoc } from "@/lib/news/shared/rich-text";

import { type Sel, caret, textblockNodes, contentOf, inlineText } from "./model";

/** Small builders so a test reads as the document it describes. Test-only. */

export const t = (text: string, ...marks: Mark[]): InlineNode =>
  marks.length ? { type: "text", text, marks } : { type: "text", text };

export const p = (...content: Array<string | InlineNode>): BlockNode => {
  const nodes = content.map((c) => (typeof c === "string" ? t(c) : c));
  return nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" };
};

export const h = (level: 1 | 2 | 3, text: string): BlockNode => ({
  type: "heading",
  attrs: { level },
  content: [t(text)],
});

export const ul = (...items: string[]): BlockNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});

export const ol = (...items: string[]): BlockNode => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});

export const quote = (...lines: string[]): BlockNode => ({
  type: "blockquote",
  content: lines.map((line) => p(line)),
});

export const hr = (): BlockNode => ({ type: "horizontalRule" });

export const img = (src = "https://example.com/a.jpg"): BlockNode => ({
  type: "image",
  attrs: { src, alt: "", title: null, width: null, height: null },
});

export const doc = (...content: BlockNode[]): RichDoc => ({ type: "doc", content });

export const at = (tb: number, off: number): Sel => caret({ tb, off });

export const range = (a: [number, number], b: [number, number]): Sel => ({
  anchor: { tb: a[0], off: a[1] },
  focus: { tb: b[0], off: b[1] },
});

/** Every textblock's plain text, in order — the shortest way to assert on structure. */
export const texts = (d: RichDoc): string[] => textblockNodes(d).map((n) => inlineText(contentOf(n)));

/** Node types of the top-level blocks. */
export const shape = (d: RichDoc): string[] => d.content.map((b) => b.type);
