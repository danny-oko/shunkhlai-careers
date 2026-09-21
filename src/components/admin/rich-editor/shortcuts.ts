import type { RichDoc } from "@/lib/news/shared/rich-text";

import {
  deleteChars,
  dividerBlock,
  finish,
  setBlockType,
  toggleList,
  toggleQuote,
} from "./commands";
import {
  type Change,
  type Sel,
  asLoose,
  caret,
  cloneDoc,
  contentOf,
  inlineLength,
  inlineText,
  isCollapsed,
  mapInlineRange,
  paragraph,
  addMark,
  setContent,
  sliceInlines,
  textblockNodes,
  textblockPaths,
} from "./model";
import { STRINGS } from "./strings";

/**
 * Markdown-style shortcuts that consume their marker.
 *
 * Typing `## ` turns the paragraph into a heading and the `## ` is gone —
 * nothing in the content is left for the reader to see. Each function looks at
 * the text before the caret and either returns a changed document or `null`;
 * none of them run during IME composition (the component guards that), and all
 * of them only fire on a plain top-level paragraph, so a `-` typed inside a
 * heading or a quote stays a hyphen.
 */

type Block = { tb: number; text: string; off: number; plain: boolean };

/** The textblock the caret is in, when it is a plain top-level paragraph. */
function plainParagraph(doc: RichDoc, sel: Sel): Block | null {
  if (!isCollapsed(sel)) return null;
  const { tb, off } = sel.focus;
  const path = textblockPaths(doc)[tb];
  const node = textblockNodes(doc)[tb];
  if (!path || !node) return null;
  return { tb, off, text: inlineText(contentOf(node)), plain: path.length === 1 && node.type === "paragraph" };
}

/**
 * `#`, `##`, `###` + space; `-`, `*`, `+` + space; `1.` + space; `>` + space.
 * The caret must sit right after the space, at the start of the paragraph.
 */
export function applyBlockShortcut(doc: RichDoc, sel: Sel): Change | null {
  const block = plainParagraph(doc, sel);
  if (!block || !block.plain) return null;

  const before = block.text.slice(0, block.off);
  const match = /^(#{1,3}|[-*+]|\d{1,3}\.|>) $/u.exec(before);
  if (!match) return null;

  const marker = match[1];
  const cleared = deleteChars(doc, block.tb, 0, before.length);
  const at = caret({ tb: block.tb, off: 0 });

  if (marker.startsWith("#")) return setBlockType(cleared, at, Math.min(3, marker.length) as 1 | 2 | 3);
  if (marker === ">") return toggleQuote(cleared, at);
  if (/^\d/u.test(marker)) return toggleList(cleared, at, "orderedList", Math.max(1, Number.parseInt(marker, 10)));
  return toggleList(cleared, at, "bulletList");
}

/** `---` on its own line, then Enter, becomes a rule with a fresh paragraph after it. */
export function applyDividerShortcut(doc: RichDoc, sel: Sel): Change | null {
  const block = plainParagraph(doc, sel);
  if (!block || !block.plain || !/^(?:-{3,}|\*{3,}|_{3,})$/u.test(block.text) || block.off !== block.text.length) {
    return null;
  }

  const next = asLoose(cloneDoc(doc));
  const top = textblockPaths(next)[block.tb][0];
  next.content?.splice(top, 1, asLoose(dividerBlock()), paragraph());
  return finish(next, caret({ tb: block.tb, off: 0 }));
}

const BOLD = /\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/u;
const ITALIC = /(?<![*\p{L}\p{N}])\*([^*\s](?:[^*]*[^*\s])?)\*$/u;
const STRIKE = /~~([^~\s](?:[^~]*[^~\s])?)~~$/u;

/**
 * `**bold**`, `*italic*` and `~~strike~~`, converted when the closing delimiter
 * is typed. The delimiters are deleted and the words between keep the mark.
 */
export function applyInlineShortcut(doc: RichDoc, sel: Sel): Change | null {
  const block = plainParagraph(doc, sel);
  if (!block) return null;

  const before = block.text.slice(0, block.off);
  const rules = [
    { pattern: BOLD, mark: "bold", size: 2 },
    { pattern: STRIKE, mark: "strike", size: 2 },
    { pattern: ITALIC, mark: "italic", size: 1 },
  ] as const;

  for (const { pattern, mark, size } of rules) {
    const found = pattern.exec(before);
    if (!found) continue;

    const start = found.index;
    const inner = found[1];
    const next = asLoose(cloneDoc(doc));
    const node = textblockNodes(next)[block.tb];

    // Closing delimiter first, so the opening offsets do not move.
    const cut = (from: number, to: number) =>
      setContent(node, [
        ...sliceInlines(contentOf(node), 0, from),
        ...sliceInlines(contentOf(node), to, Number.POSITIVE_INFINITY),
      ]);
    cut(block.off - size, block.off);
    cut(start, start + size);

    const to = start + inner.length;
    setContent(node, mapInlineRange(contentOf(node), start, to, (run) => addMark(run, { type: mark })));
    return { doc: next as unknown as RichDoc, sel: caret({ tb: block.tb, off: to }) };
  }
  return null;
}

/* --- the slash menu -------------------------------------------------------- */

export type SlashId =
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "numbered"
  | "quote"
  | "divider"
  | "image";

export type SlashItem = { id: SlashId; label: string; hint: string; keywords: string };

export const SLASH_ITEMS: SlashItem[] = [
  { id: "heading1", ...STRINGS.slash.heading1, keywords: "heading title h1 гарчиг" },
  { id: "heading2", ...STRINGS.slash.heading2, keywords: "subheading subtitle h2 дэд гарчиг" },
  { id: "heading3", ...STRINGS.slash.heading3, keywords: "minor h3 жижиг гарчиг" },
  { id: "bullet", ...STRINGS.slash.bullet, keywords: "bullet list ul жагсаалт тэмдэгт" },
  { id: "numbered", ...STRINGS.slash.numbered, keywords: "numbered ordered list ol жагсаалт дугаар" },
  { id: "quote", ...STRINGS.slash.quote, keywords: "quote blockquote ишлэл" },
  { id: "divider", ...STRINGS.slash.divider, keywords: "divider rule hr line зураас тусгаарлах" },
  { id: "image", ...STRINGS.slash.image, keywords: "image picture photo зураг" },
];

export function filterSlashItems(query: string): SlashItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(needle));
}

/**
 * The open slash query, if the caret is at the end of a plain paragraph that
 * holds nothing but `/` and a few characters.
 */
export function slashQuery(doc: RichDoc, sel: Sel): { tb: number; query: string } | null {
  const block = plainParagraph(doc, sel);
  if (!block || !block.plain || block.off !== block.text.length) return null;
  const match = /^\/([^\s/]{0,20})$/u.exec(block.text);
  return match ? { tb: block.tb, query: match[1] } : null;
}

/** Removes the typed `/query`, leaving an empty paragraph for the command to act on. */
export function clearSlash(doc: RichDoc, tb: number): RichDoc {
  const node = textblockNodes(doc)[tb];
  return deleteChars(doc, tb, 0, inlineLength(contentOf(node)));
}
