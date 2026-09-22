import { type BlockNode, type InlineNode, type RichDoc, emptyDoc, sanitizeDoc } from "./shared/rich-text";
import type { NewsBlock } from "./types";

/**
 * Reading the body format this newsroom used before rich text.
 *
 * Articles were stored as `NewsBlock[]` (paragraph, heading, quote, list) and
 * `.mock-data/news.json` on a developer's disk, and the seed, still hold that
 * shape. Rather than migrate files nobody can find, every read goes through
 * `coerceBody`, which accepts either shape and always returns a `RichDoc`.
 *
 * Pure and never throws: it runs on whatever a file on disk contains.
 */

function text(value: string): InlineNode[] {
  const clean = value.trim();
  return clean ? [{ type: "text", text: clean }] : [];
}

function paragraph(value: string): BlockNode {
  const content = text(value);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

/**
 * Blocks to a document.
 *
 * A quote's attribution becomes a closing paragraph that starts with an em
 * dash; the renderer sets a trailing paragraph of that shape as the quote's
 * byline, so the old look survives without a node type the format lacks.
 */
export function blocksToDoc(blocks: NewsBlock[]): RichDoc {
  const content: BlockNode[] = [];

  for (const block of blocks ?? []) {
    if (!block || typeof block !== "object") continue;

    switch (block.kind) {
      case "heading": {
        const inline = text(block.text ?? "");
        if (inline.length > 0) {
          // Level 1 renders as the page's h2, which is what `##` always was.
          content.push({ type: "heading", attrs: { level: 1 }, content: inline });
        }
        break;
      }
      case "quote": {
        const lines = [paragraph(block.text ?? "")];
        const by = (block.attribution ?? "").trim();
        if (by) lines.push(paragraph(`— ${by}`));
        if (text(block.text ?? "").length > 0) content.push({ type: "blockquote", content: lines });
        break;
      }
      case "list": {
        const items = (block.items ?? [])
          .filter((item) => typeof item === "string" && item.trim())
          .map((item) => ({ type: "listItem" as const, content: [paragraph(item)] }));
        if (items.length > 0) content.push({ type: "bulletList", content: items });
        break;
      }
      case "paragraph": {
        if (text(block.text ?? "").length > 0) content.push(paragraph(block.text));
        break;
      }
    }
  }

  return sanitizeDoc({ type: "doc", content });
}

/** The old shape: an array whose members carry a string `kind`. */
export function isLegacyBody(value: unknown): value is NewsBlock[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) => entry && typeof entry === "object" && typeof (entry as { kind?: unknown }).kind === "string",
    )
  );
}

/** Blank-line separated plain text: what a non-JSON `body` field means. */
export function plainTextToDoc(source: string): RichDoc {
  const blocks = source
    .replace(/\r\n?/gu, "\n")
    .split(/\n{2,}/u)
    .map((chunk) => chunk.replace(/\s*\n\s*/gu, " ").trim())
    .filter(Boolean)
    .map((chunk): NewsBlock => ({ kind: "paragraph", text: chunk }));
  return blocksToDoc(blocks);
}

/** Either shape in, a sanitised `RichDoc` out. Garbage becomes an empty document. */
export function coerceBody(value: unknown): RichDoc {
  if (isLegacyBody(value)) return blocksToDoc(value);
  if (value && typeof value === "object" && !Array.isArray(value)) return sanitizeDoc(value);
  return emptyDoc();
}

/**
 * What the form's `body` field held, as a document.
 *
 * The editor posts JSON. Anything that is not JSON — a client without the
 * script, an old cached page — is read as blank-line separated plain text
 * rather than refused, so words typed into a box are never lost to a format
 * error.
 */
export function bodyFromField(raw: string): RichDoc {
  const source = (raw ?? "").trim();
  if (source.startsWith("{")) {
    try {
      return coerceBody(JSON.parse(source));
    } catch {
      // Fall through: a body that merely starts with a brace is still text.
    }
  }
  return plainTextToDoc(source);
}
