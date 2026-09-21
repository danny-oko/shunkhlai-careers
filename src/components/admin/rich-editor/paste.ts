import type { BlockNode, InlineNode, Mark, RichDoc } from "@/lib/news/shared/rich-text";
import { sanitizeDoc } from "@/lib/news/shared/rich-text";

import { htmlToDoc } from "./dom";
import { insertBlocks, insertInlines } from "./commands";
import { type Change, type Sel, mergeInlines } from "./model";

/**
 * What arrives from the clipboard or a drop, as a document.
 *
 * HTML goes through the same DOM converter the editor uses on itself. Plain
 * text goes through a small markdown reader, so pasting a README does not
 * leave `##` and `**` on the page — but only when the text is *clearly*
 * markdown. A stray asterisk in ordinary prose is left alone.
 */

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/u;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u;
const BULLET = /^\s*[-*+]\s+(.*)$/u;
const ORDERED = /^\s*(\d{1,3})[.)]\s+(.*)$/u;
const QUOTE = /^\s{0,3}>\s?(.*)$/u;

export function looksLikeMarkdown(text: string): boolean {
  if (/\*\*[^*\n]+\*\*/u.test(text) || /\[[^\]\n]+\]\((?:[^()\s]|\([^()\s]*\))+\)/u.test(text)) return true;
  return text.split(/\r?\n/u).some(
    (line) => HEADING.test(line) || RULE.test(line) || BULLET.test(line) || ORDERED.test(line) || QUOTE.test(line),
  );
}

type Rule = { pattern: RegExp; mark: (match: RegExpExecArray) => Mark | null; group: number };

const INLINE_RULES: Rule[] = [
  { pattern: /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/u, mark: (m) => ({ type: "link", attrs: { href: m[2], target: null } }), group: 1 },
  { pattern: /\*\*(?=\S)(.+?)(?<=\S)\*\*/u, mark: () => ({ type: "bold" }), group: 1 },
  { pattern: /__(?=\S)(.+?)(?<=\S)__/u, mark: () => ({ type: "bold" }), group: 1 },
  { pattern: /~~(?=\S)(.+?)(?<=\S)~~/u, mark: () => ({ type: "strike" }), group: 1 },
  { pattern: /(?<![*\p{L}\p{N}])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?!\*)/u, mark: () => ({ type: "italic" }), group: 1 },
  { pattern: /(?<![_\p{L}\p{N}])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![_\p{L}\p{N}])/u, mark: () => ({ type: "italic" }), group: 1 },
  { pattern: /`([^`\n]+)`/u, mark: () => null, group: 1 },
];

/** Inline markdown to marked text. Unmatched delimiters stay as written. */
export function parseInlineMarkdown(text: string, marks: Mark[] = []): InlineNode[] {
  let best: { rule: Rule; match: RegExpExecArray } | null = null;
  for (const rule of INLINE_RULES) {
    const match = rule.pattern.exec(text);
    if (match && (!best || match.index < best.match.index)) best = { rule, match };
  }
  if (!best) return text ? [{ type: "text", text, ...(marks.length ? { marks } : {}) }] : [];

  const { rule, match } = best;
  const mark = rule.mark(match);
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return [
    ...(before ? parseInlineMarkdown(before, marks) : []),
    ...parseInlineMarkdown(match[rule.group], mark ? [...marks, mark] : marks),
    ...parseInlineMarkdown(after, marks),
  ];
}

function inline(text: string, markdown: boolean): InlineNode[] {
  return markdown ? parseInlineMarkdown(text) : text ? [{ type: "text", text }] : [];
}

const para = (content: InlineNode[]): BlockNode =>
  content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };

/** Plain text to a document; markdown structure is honoured when the text is clearly markdown. */
export function textToDoc(text: string): RichDoc {
  const markdown = looksLikeMarkdown(text);
  const blocks: BlockNode[] = [];

  let lines: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;
  let quote: string[] = [];

  const flushLines = () => {
    if (lines.length === 0) return;
    const content: InlineNode[] = [];
    lines.forEach((line, index) => {
      if (index > 0) content.push({ type: "hardBreak" });
      content.push(...inline(line, markdown));
    });
    blocks.push(para(content));
    lines = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item) => ({ type: "listItem" as const, content: [para(inline(item, markdown))] }));
    blocks.push(
      list.ordered
        ? { type: "orderedList", attrs: { start: list.start }, content: items }
        : { type: "bulletList", content: items },
    );
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push({ type: "blockquote", content: quote.map((line) => para(inline(line, markdown))) });
    quote = [];
  };
  const flushAll = () => {
    flushLines();
    flushList();
    flushQuote();
  };

  for (const raw of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = raw.replace(/\s+$/u, "");
    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (markdown) {
      const heading = HEADING.exec(line);
      if (heading) {
        flushAll();
        blocks.push({
          type: "heading",
          attrs: { level: Math.min(3, heading[1].length) as 1 | 2 | 3 },
          content: inline(heading[2], true),
        });
        continue;
      }
      if (RULE.test(line)) {
        flushAll();
        blocks.push({ type: "horizontalRule" });
        continue;
      }
      const bullet = BULLET.exec(line);
      if (bullet) {
        flushLines();
        flushQuote();
        if (list && list.ordered) flushList();
        list ??= { ordered: false, start: 1, items: [] };
        list.items.push(bullet[1]);
        continue;
      }
      const ordered = ORDERED.exec(line);
      if (ordered) {
        flushLines();
        flushQuote();
        if (list && !list.ordered) flushList();
        list ??= { ordered: true, start: Math.max(1, Number(ordered[1])), items: [] };
        list.items.push(ordered[2]);
        continue;
      }
      const quoted = QUOTE.exec(line);
      if (quoted) {
        flushLines();
        flushList();
        quote.push(quoted[1]);
        continue;
      }
    }

    flushList();
    flushQuote();
    lines.push(line.trim());
  }
  flushAll();

  return sanitizeDoc({ type: "doc", content: blocks });
}

const STRUCTURED = new Set(["heading", "bulletList", "orderedList", "blockquote", "image", "horizontalRule"]);

function hasStructure(doc: RichDoc): boolean {
  return JSON.stringify(doc).includes('"marks"') || doc.content.some((block) => STRUCTURED.has(block.type));
}

/** Clipboard or drop payload to a document. HTML wins unless it is markdown source wearing a `<div>`. */
export function clipboardToDoc(payload: { html?: string; text?: string }): RichDoc {
  const html = payload.html?.trim();
  const text = payload.text ?? "";

  if (html) {
    const fromHtml = htmlToDoc(html);
    const blank = fromHtml.content.every((block) => block.type === "paragraph" && !block.content?.length);
    if (!blank && (hasStructure(fromHtml) || !looksLikeMarkdown(text))) return fromHtml;
  }
  return textToDoc(text);
}

/** A pasted document, dropped in at the caret. One paragraph merges into the line; more split it. */
export function pasteInto(doc: RichDoc, sel: Sel, pasted: RichDoc): Change {
  const blocks = [...pasted.content];
  while (blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    if (last.type === "paragraph" && !last.content?.length) blocks.pop();
    else break;
  }
  if (blocks.length === 0) return { doc, sel };

  if (blocks.length === 1 && blocks[0].type === "paragraph") {
    return insertInlines(doc, sel, mergeInlines(blocks[0].content ?? []));
  }
  return insertBlocks(doc, sel, blocks);
}
