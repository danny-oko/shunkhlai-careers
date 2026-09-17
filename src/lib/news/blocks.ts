import type { NewsBlock } from "./types";

/**
 * The article body, as an editor types it.
 *
 * A block array is what the site renders, but nobody wants to author JSON, and
 * a rich-text editor is a dependency and a security surface this newsroom does
 * not need. So the editor is a `<textarea>` holding a tiny line-based syntax,
 * and these two functions are the only place that knows it:
 *
 *     ## Гарчиг                  heading
 *     > Ишлэл — Хэлсэн хүн       quote (em dash or ` -- ` splits the attribution)
 *     - мөр                      list (consecutive `- ` lines are one block)
 *     anything else              paragraph
 *
 * Blocks are separated by blank lines. Soft-wrapped lines inside a paragraph
 * join with a space, so a pasted paragraph that arrives hard-wrapped at 80
 * columns still renders as one.
 *
 * Both functions are pure and neither throws: this runs on whatever an editor
 * pasted, and a malformed body must degrade to paragraphs rather than 500 the
 * admin screen. `parseBody(serializeBody(blocks))` round-trips.
 */

const HEADING = /^##\s+(.*)$/u;
const QUOTE = /^>\s?(.*)$/u;
const LIST_ITEM = /^-\s+(.*)$/u;

/** Em dash or a spaced double hyphen, whichever the editor reached for. */
const ATTRIBUTION = /\s+(?:—|--)\s+/u;

function quoteBlock(lines: string[]): NewsBlock {
  const text = lines.join(" ").trim();
  const split = ATTRIBUTION.exec(text);
  if (!split) return { kind: "quote", text, attribution: null };

  const at = split.index;
  return {
    kind: "quote",
    text: text.slice(0, at).trim(),
    attribution: text.slice(at + split[0].length).trim() || null,
  };
}

type Kind = NewsBlock["kind"];

function kindOf(line: string): Kind {
  if (HEADING.test(line)) return "heading";
  if (QUOTE.test(line)) return "quote";
  if (LIST_ITEM.test(line)) return "list";
  return "paragraph";
}

/** One run of same-kind lines becomes at most one block. Empty runs vanish. */
function blockFrom(kind: Kind, lines: string[]): NewsBlock | null {
  if (kind === "heading") {
    const text = HEADING.exec(lines[0])?.[1]?.trim() ?? "";
    return text ? { kind: "heading", text } : null;
  }

  if (kind === "quote") {
    const block = quoteBlock(lines.map((line) => QUOTE.exec(line)?.[1] ?? line));
    return block.kind === "quote" && block.text ? block : null;
  }

  if (kind === "list") {
    const items = lines
      .map((line) => LIST_ITEM.exec(line)?.[1]?.trim())
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? { kind: "list", items } : null;
  }

  const text = lines.join(" ").trim();
  return text ? { kind: "paragraph", text } : null;
}

export function parseBody(source: string): NewsBlock[] {
  const blocks: NewsBlock[] = [];

  // Line-driven rather than chunk-driven. Classifying a whole blank-line
  // chunk by its first line loses everything after it: "## Гарчиг" followed
  // on the next line by a paragraph would publish the heading and silently
  // drop the paragraph. A run ends when the kind changes, when a blank line
  // arrives, or — for a heading, which is always one line — immediately.
  let kind: Kind | null = null;
  let run: string[] = [];

  const flush = () => {
    if (kind && run.length > 0) {
      const block = blockFrom(kind, run);
      if (block) blocks.push(block);
    }
    kind = null;
    run = [];
  };

  for (const raw of (source ?? "").replace(/\r\n?/gu, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }

    const lineKind = kindOf(line);
    if (kind !== null && (kind !== lineKind || lineKind === "heading")) flush();
    kind = lineKind;
    run.push(line);
  }

  flush();
  return blocks;
}

export function serializeBody(blocks: NewsBlock[]): string {
  return (blocks ?? [])
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `## ${block.text}`;
        case "quote":
          // The em dash is what `parseBody` prefers, so a round trip through
          // the editor does not rewrite the author's punctuation.
          return block.attribution
            ? `> ${block.text} — ${block.attribution}`
            : `> ${block.text}`;
        case "list":
          return block.items.map((item) => `- ${item}`).join("\n");
        default:
          return block.text;
      }
    })
    .join("\n\n");
}
