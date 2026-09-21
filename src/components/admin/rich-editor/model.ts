import type {
  InlineNode,
  Mark,
  RichDoc,
  TextNode,
} from "@/lib/news/shared/rich-text";

/**
 * The editor's document model: positions, and the read-only questions the
 * toolbar and the commands ask of a `RichDoc`.
 *
 * A position is `{ tb, off }` — the index of a *textblock* (a paragraph or a
 * heading, counted depth-first through lists and quotes) and a character
 * offset inside it, a hard break counting as one character. That is the whole
 * selection vocabulary: it does not mention the DOM, so every command is a
 * pure `(doc, sel) => { doc, sel }` function that a test can run without a
 * browser, and a selection survives the editor re-rendering its DOM.
 *
 * Commands work on a private clone (`cloneDoc`) through the deliberately
 * loose `Loose` shape below; they take and return the strict `RichDoc`.
 */

export type Pos = { tb: number; off: number };
export type Sel = { anchor: Pos; focus: Pos };
export type Path = number[];
export type Change = { doc: RichDoc; sel: Sel };

export type MarkType = Mark["type"];
export type SimpleMark = Exclude<MarkType, "link">;

/** Mutable, loosely typed view of any node. Internal to the editor. */
export type Loose = {
  type: string;
  content?: Loose[];
  attrs?: { level?: number; start?: number; [key: string]: unknown };
  text?: string;
  marks?: Mark[];
};

export const asLoose = (value: unknown): Loose => value as Loose;
export const asDoc = (value: Loose): RichDoc => value as unknown as RichDoc;

export function cloneDoc(doc: RichDoc): RichDoc {
  return JSON.parse(JSON.stringify(doc)) as RichDoc;
}

export function paragraph(content: InlineNode[] = []): Loose {
  return content.length > 0
    ? { type: "paragraph", content: content as unknown as Loose[] }
    : { type: "paragraph" };
}

export const isTextblock = (node: Loose): boolean =>
  node.type === "paragraph" || node.type === "heading";

export const isAtom = (node: Loose): boolean =>
  node.type === "image" || node.type === "horizontalRule";

const CONTAINERS = new Set(["bulletList", "orderedList", "listItem", "blockquote"]);
export const isContainer = (node: Loose): boolean => CONTAINERS.has(node.type);

/* --- structure ------------------------------------------------------------ */

/** Every textblock, in reading order, as index paths from the document. */
export function textblockPaths(doc: RichDoc | Loose): Path[] {
  const out: Path[] = [];
  const walk = (node: Loose, prefix: Path) => {
    (node.content ?? []).forEach((child, index) => {
      if (isTextblock(child)) out.push([...prefix, index]);
      else if (isContainer(child)) walk(child, [...prefix, index]);
    });
  };
  walk(asLoose(doc), []);
  return out;
}

export function nodeAt(doc: RichDoc | Loose, path: Path): Loose {
  let node = asLoose(doc);
  for (const index of path) node = (node.content ?? [])[index];
  return node;
}

export function textblockNodes(doc: RichDoc | Loose): Loose[] {
  return textblockPaths(doc).map((path) => nodeAt(doc, path));
}

export function countTextblocks(nodes: Loose[]): number {
  return textblockPaths({ type: "doc", content: nodes }).length;
}

/* --- inline content ------------------------------------------------------- */

const MARK_ORDER: MarkType[] = ["link", "bold", "italic", "underline", "strike"];

function canonMarks(marks: Mark[] | undefined): Mark[] | undefined {
  if (!marks || marks.length === 0) return undefined;
  return [...marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
}

function sameMarks(a?: Mark[], b?: Mark[]): boolean {
  return JSON.stringify(canonMarks(a) ?? []) === JSON.stringify(canonMarks(b) ?? []);
}

function textNode(text: string, marks?: Mark[]): TextNode {
  const canon = canonMarks(marks);
  return canon ? { type: "text", text, marks: canon } : { type: "text", text };
}

/** Empty runs dropped, neighbours with identical marks joined, marks ordered. */
export function mergeInlines(content: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const node of content) {
    if (node.type === "hardBreak") {
      out.push(node);
      continue;
    }
    if (!node.text) continue;
    const last = out[out.length - 1];
    if (last && last.type === "text" && sameMarks(last.marks, node.marks)) {
      out[out.length - 1] = textNode(last.text + node.text, last.marks);
    } else {
      out.push(textNode(node.text, node.marks));
    }
  }
  return out;
}

export function inlineLength(content: InlineNode[] | undefined): number {
  return (content ?? []).reduce((sum, node) => sum + (node.type === "text" ? node.text.length : 1), 0);
}

/** Plain text of inline content; a hard break is one newline, so offsets line up. */
export function inlineText(content: InlineNode[] | undefined): string {
  return (content ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join("");
}

export const contentOf = (node: Loose): InlineNode[] => (node.content ?? []) as unknown as InlineNode[];

export function sliceInlines(content: InlineNode[], from: number, to: number): InlineNode[] {
  const out: InlineNode[] = [];
  let cursor = 0;
  for (const node of content) {
    const length = node.type === "text" ? node.text.length : 1;
    const start = cursor;
    const end = cursor + length;
    cursor = end;
    if (end <= from || start >= to) continue;
    if (node.type === "hardBreak") out.push(node);
    else out.push(textNode(node.text.slice(Math.max(from, start) - start, Math.min(to, end) - start), node.marks));
  }
  return out;
}

export function setContent(node: Loose, content: InlineNode[]): void {
  const merged = mergeInlines(content);
  if (merged.length > 0) node.content = merged as unknown as Loose[];
  else delete node.content;
}

function withMark(node: TextNode, mark: Mark): TextNode {
  return textNode(node.text, [...(node.marks ?? []).filter((m) => m.type !== mark.type), mark]);
}

function withoutMark(node: TextNode, type: MarkType): TextNode {
  return textNode(node.text, (node.marks ?? []).filter((m) => m.type !== type));
}

/** Applies `fn` to the text between two offsets, splitting runs at the edges. */
export function mapInlineRange(
  content: InlineNode[],
  from: number,
  to: number,
  fn: (node: TextNode) => TextNode,
): InlineNode[] {
  const middle = sliceInlines(content, from, to).map((node) => (node.type === "text" ? fn(node) : node));
  return mergeInlines([
    ...sliceInlines(content, 0, from),
    ...middle,
    ...sliceInlines(content, to, Number.POSITIVE_INFINITY),
  ]);
}

export function addMark(node: TextNode, mark: Mark): TextNode {
  return withMark(node, mark);
}
export function removeMark(node: TextNode, type: MarkType): TextNode {
  return withoutMark(node, type);
}
export function clearMarks(node: TextNode): TextNode {
  return textNode(node.text);
}

/* --- selection ------------------------------------------------------------ */

const isBefore = (a: Pos, b: Pos) => a.tb < b.tb || (a.tb === b.tb && a.off <= b.off);

export function orderedSel(sel: Sel): { start: Pos; end: Pos } {
  return isBefore(sel.anchor, sel.focus)
    ? { start: sel.anchor, end: sel.focus }
    : { start: sel.focus, end: sel.anchor };
}

export const isCollapsed = (sel: Sel): boolean =>
  sel.anchor.tb === sel.focus.tb && sel.anchor.off === sel.focus.off;

export const caret = (pos: Pos): Sel => ({ anchor: pos, focus: pos });

export type Segment = { tb: number; from: number; to: number };

/** The slice of every textblock the selection touches. */
export function segments(doc: RichDoc, sel: Sel): Segment[] {
  const nodes = textblockNodes(doc);
  const { start, end } = orderedSel(sel);
  const out: Segment[] = [];
  for (let tb = start.tb; tb <= end.tb && tb < nodes.length; tb += 1) {
    const length = inlineLength(contentOf(nodes[tb]));
    out.push({
      tb,
      from: tb === start.tb ? Math.min(start.off, length) : 0,
      to: tb === end.tb ? Math.min(end.off, length) : length,
    });
  }
  return out;
}

const isWordChar = (char: string | undefined) => Boolean(char) && /[\p{L}\p{N}]/u.test(char as string);

/** The word around a caret, for a mark toggled with nothing selected. */
export function wordRange(text: string, off: number): [number, number] | null {
  let left = off;
  let right = off;
  while (left > 0 && isWordChar(text[left - 1])) left -= 1;
  while (right < text.length && isWordChar(text[right])) right += 1;
  return left === right ? null : [left, right];
}

/* --- what is active at the selection -------------------------------------- */

export type LinkInfo = { href: string; target: "_blank" | null };

export type ActiveState = {
  marks: Set<MarkType>;
  link: LinkInfo | null;
  /** 0 for a paragraph, 1-3 for a heading, null when mixed or not text. */
  heading: 0 | 1 | 2 | 3 | null;
  list: "bulletList" | "orderedList" | null;
  quote: boolean;
  /** Headings only apply to top-level text; lists and quotes switch them off. */
  canHeading: boolean;
};

function textNodesAt(content: InlineNode[], from: number, to: number, collapsed: boolean): TextNode[] {
  if (!collapsed) return sliceInlines(content, from, to).filter((n): n is TextNode => n.type === "text");
  // A caret inherits from the text it follows, or the text after it at line start.
  const before = sliceInlines(content, Math.max(0, from - 1), from);
  const nodes = before.length > 0 ? before : sliceInlines(content, from, from + 1);
  return nodes.filter((n): n is TextNode => n.type === "text");
}

export function activeState(doc: RichDoc, sel: Sel): ActiveState {
  const paths = textblockPaths(doc);
  const nodes = paths.map((path) => nodeAt(doc, path));
  const collapsed = isCollapsed(sel);
  const segs = segments(doc, sel);

  let marks = null as Set<MarkType> | null;
  let link = null as LinkInfo | null;
  for (const seg of segs) {
    const texts = textNodesAt(contentOf(nodes[seg.tb]), seg.from, seg.to, collapsed);
    for (const text of texts) {
      const here = new Set((text.marks ?? []).map((mark) => mark.type));
      marks = marks ? new Set([...marks].filter((type) => here.has(type))) : here;
      const l = (text.marks ?? []).find((mark) => mark.type === "link");
      if (l && l.type === "link" && !link) link = { href: l.attrs.href, target: l.attrs.target };
    }
  }

  const levels = new Set<number | null>();
  let list: ActiveState["list"] = null;
  let quote = false;
  let canHeading = true;
  for (const seg of segs) {
    const path = paths[seg.tb];
    const node = nodes[seg.tb];
    const chain = path.slice(0, -1).map((_, i) => nodeAt(doc, path.slice(0, i + 1)));
    if (chain.some((n) => n.type === "listItem")) {
      canHeading = false;
      list = chain.find((n) => n.type === "bulletList" || n.type === "orderedList")?.type as ActiveState["list"];
    }
    if (chain.some((n) => n.type === "blockquote")) {
      quote = true;
      canHeading = false;
    }
    levels.add(node.type === "heading" ? (node.attrs?.level ?? 2) : 0);
  }

  return {
    marks: marks ?? new Set(),
    link,
    heading: levels.size === 1 ? ([...levels][0] as 0 | 1 | 2 | 3) : null,
    list,
    quote,
    canHeading,
  };
}

/* --- saving --------------------------------------------------------------- */

/**
 * The document as it should be stored: no trailing empty paragraphs (the
 * editor keeps one to type into) and always at least one block.
 */
export function cleanForSave(doc: RichDoc): RichDoc {
  const content = [...doc.content];
  while (content.length > 1) {
    const last = content[content.length - 1];
    if (last.type === "paragraph" && !last.content?.length) content.pop();
    else break;
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}
