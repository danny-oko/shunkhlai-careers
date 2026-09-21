import { type BlockNode, type ImageAttrs, type InlineNode, type RichDoc, sanitizeDoc } from "@/lib/news/shared/rich-text";

import {
  type Change,
  type Loose,
  type MarkType,
  type Path,
  type Pos,
  type Sel,
  type SimpleMark,
  addMark,
  asDoc,
  asLoose,
  caret,
  clearMarks,
  cloneDoc,
  contentOf,
  countTextblocks,
  inlineLength,
  inlineText,
  isAtom,
  isCollapsed,
  isTextblock,
  mapInlineRange,
  mergeInlines,
  nodeAt,
  orderedSel,
  paragraph,
  removeMark,
  segments,
  setContent,
  sliceInlines,
  textblockNodes,
  textblockPaths,
  wordRange,
} from "./model";

/**
 * Every editing command, as a pure function from a document and a selection to
 * a new document and selection (or `null` when there is nothing to do).
 *
 * None of these touch the DOM. The component reads the DOM into a `RichDoc`,
 * applies one of these, renders the result and puts the caret back — which is
 * what makes them testable in plain node, and what keeps Enter, Backspace and
 * every toolbar button behaving the same in every browser instead of leaving
 * those decisions to each engine's contentEditable.
 */

const INF = Number.POSITIVE_INFINITY;

const inlines = (node: Loose) => contentOf(node);

function begin(doc: RichDoc): { next: Loose; paths: Path[]; nodes: Loose[] } {
  const next = asLoose(cloneDoc(doc));
  const paths = textblockPaths(next);
  return { next, paths, nodes: paths.map((path) => nodeAt(next, path)) };
}

/**
 * Keeps a caret target on both ends of the document: an image or a rule as
 * the first or last block would leave nowhere to click. Adding one at the
 * front shifts every textblock index, so the selection moves with it.
 */
export function finish(next: Loose, sel: Sel): Change {
  if (!next.content || next.content.length === 0) next.content = [paragraph()];
  let shift = 0;
  if (isAtom(next.content[0])) {
    next.content.unshift(paragraph());
    shift = 1;
  }
  if (isAtom(next.content[next.content.length - 1])) next.content.push(paragraph());
  const move = (pos: Pos): Pos => ({ tb: pos.tb + shift, off: pos.off });
  return { doc: asDoc(next), sel: { anchor: move(sel.anchor), focus: move(sel.focus) } };
}

/** A document ready to edit: sanitised, and with somewhere to put the caret at both ends. */
export function prepareDoc(input: unknown): RichDoc {
  return finish(asLoose(cloneDoc(sanitizeDoc(input))), caret({ tb: 0, off: 0 })).doc;
}

/** Where the first textblock at or after a top-level index sits. */
function firstTextblockFrom(next: Loose, top: number): number {
  const paths = textblockPaths(next);
  const found = paths.findIndex((path) => path[0] >= top);
  return found === -1 ? Math.max(0, paths.length - 1) : found;
}

/* --- marks ---------------------------------------------------------------- */

/**
 * Bold, italic, underline or strike.
 *
 * With a range selected it is all-or-nothing, like every editor: if every
 * character already has the mark it comes off, otherwise it goes on. With only
 * a caret it applies to the word around it — there is no "typing state" to
 * carry into text that has not been typed yet, and a mark that silently
 * waited for the next keystroke is exactly what makes toolbars feel broken.
 */
export function toggleMark(doc: RichDoc, sel: Sel, type: SimpleMark): Change | null {
  const { next, nodes } = begin(doc);
  let segs = segments(doc, sel);

  if (isCollapsed(sel)) {
    const seg = segs[0];
    const range = wordRange(inlineText(inlines(nodes[seg.tb])), seg.from);
    if (!range) return null;
    segs = [{ tb: seg.tb, from: range[0], to: range[1] }];
  }
  segs = segs.filter((seg) => seg.to > seg.from);
  if (segs.length === 0) return null;

  const texts = segs.flatMap((seg) => sliceInlines(inlines(nodes[seg.tb]), seg.from, seg.to));
  const runs = texts.filter((node) => node.type === "text");
  const allMarked =
    runs.length > 0 && runs.every((node) => node.type === "text" && node.marks?.some((m) => m.type === type));

  for (const seg of segs) {
    const node = nodes[seg.tb];
    setContent(
      node,
      mapInlineRange(inlines(node), seg.from, seg.to, (run) =>
        allMarked ? removeMark(run, type) : addMark(run, { type } as never),
      ),
    );
  }
  return { doc: asDoc(next), sel };
}

/** The link under a caret, as a range, or null. */
function linkExtent(content: InlineNode[], off: number): [number, number, string] | null {
  let cursor = 0;
  const spans: Array<{ from: number; to: number; href: string | null }> = [];
  for (const node of content) {
    const length = node.type === "text" ? node.text.length : 1;
    const mark = node.type === "text" ? node.marks?.find((m) => m.type === "link") : undefined;
    spans.push({ from: cursor, to: cursor + length, href: mark && mark.type === "link" ? mark.attrs.href : null });
    cursor += length;
  }
  const inside = spans.findIndex((s) => s.href && s.from < off && off <= s.to);
  const at = inside !== -1 ? inside : spans.findIndex((s) => s.href && s.from <= off && off < s.to);
  if (at === -1) return null;

  const href = spans[at].href as string;
  let left = at;
  let right = at;
  while (left > 0 && spans[left - 1].href === href) left -= 1;
  while (right < spans.length - 1 && spans[right + 1].href === href) right += 1;
  return [spans[left].from, spans[right].to, href];
}

/** The href of the link at the caret, for prefilling the popover. */
export function linkAt(doc: RichDoc, pos: Pos): { href: string; target: "_blank" | null } | null {
  const node = textblockNodes(doc)[pos.tb];
  if (!node) return null;
  const extent = linkExtent(inlines(node), pos.off);
  if (!extent) return null;
  const run = sliceInlines(inlines(node), extent[0], extent[0] + 1)[0];
  const mark = run?.type === "text" ? run.marks?.find((m) => m.type === "link") : undefined;
  return mark && mark.type === "link" ? { href: mark.attrs.href, target: mark.attrs.target } : null;
}

/**
 * Sets or (with `null`) removes a link.
 *
 * On a caret inside a link it edits that whole link. On a bare caret elsewhere
 * it inserts the address itself as the link text — the alternative is a link
 * with no words, which is invisible.
 */
export function setLink(
  doc: RichDoc,
  sel: Sel,
  link: { href: string; target: "_blank" | null } | null,
): Change | null {
  const { next, nodes } = begin(doc);
  let segs = segments(doc, sel);

  if (isCollapsed(sel)) {
    const seg = segs[0];
    const node = nodes[seg.tb];
    const extent = linkExtent(inlines(node), seg.from);
    if (extent) {
      segs = [{ tb: seg.tb, from: extent[0], to: extent[1] }];
    } else {
      if (!link) return null;
      const label: InlineNode = { type: "text", text: link.href.replace(/^(https?:\/\/|mailto:|tel:)/u, "") };
      const marked = addMark(label as never, { type: "link", attrs: link });
      setContent(node, [
        ...sliceInlines(inlines(node), 0, seg.from),
        marked,
        ...sliceInlines(inlines(node), seg.from, INF),
      ]);
      return { doc: asDoc(next), sel: caret({ tb: seg.tb, off: seg.from + label.text.length }) };
    }
  }

  segs = segs.filter((seg) => seg.to > seg.from);
  if (segs.length === 0) return null;

  for (const seg of segs) {
    const node = nodes[seg.tb];
    setContent(
      node,
      mapInlineRange(inlines(node), seg.from, seg.to, (run) =>
        link ? addMark(run, { type: "link", attrs: link }) : removeMark(run, "link"),
      ),
    );
  }
  return { doc: asDoc(next), sel };
}

/** Strips every mark in the selection (or the whole block at a caret) and flattens headings. */
export function clearFormatting(doc: RichDoc, sel: Sel): Change {
  const { next, nodes } = begin(doc);
  const collapsed = isCollapsed(sel);

  for (const seg of segments(doc, sel)) {
    const node = nodes[seg.tb];
    const from = collapsed ? 0 : seg.from;
    const to = collapsed ? INF : seg.to;
    setContent(node, mapInlineRange(inlines(node), from, to, clearMarks));
    if (node.type === "heading") {
      node.type = "paragraph";
      delete node.attrs;
    }
  }
  return { doc: asDoc(next), sel };
}

/* --- block type ----------------------------------------------------------- */

/** 0 makes a paragraph; 1-3 a heading. Top-level text only. */
export function setBlockType(doc: RichDoc, sel: Sel, level: 0 | 1 | 2 | 3): Change | null {
  const { next, nodes, paths } = begin(doc);
  const { start, end } = orderedSel(sel);
  let changed = false;

  for (let tb = start.tb; tb <= end.tb && tb < nodes.length; tb += 1) {
    if (paths[tb].length !== 1) continue;
    const node = nodes[tb];
    if (level === 0) {
      node.type = "paragraph";
      delete node.attrs;
    } else {
      node.type = "heading";
      node.attrs = { level };
    }
    changed = true;
  }
  return changed ? { doc: asDoc(next), sel } : null;
}

function topRange(paths: Path[], sel: Sel): [number, number] {
  const { start, end } = orderedSel(sel);
  const a = paths[Math.min(start.tb, paths.length - 1)]?.[0] ?? 0;
  const b = paths[Math.min(end.tb, paths.length - 1)]?.[0] ?? a;
  return [a, b];
}

const plain = (node: Loose): Loose => ({ type: "paragraph", ...(node.content ? { content: node.content } : {}) });

/**
 * Bullet or numbered list over the blocks the selection touches. Turning a
 * list into the same kind of list again takes it back to paragraphs; a list of
 * the other kind changes kind.
 */
export function toggleList(
  doc: RichDoc,
  sel: Sel,
  kind: "bulletList" | "orderedList",
  start = 1,
): Change | null {
  const { next, paths } = begin(doc);
  if (paths.length === 0) return null;
  const [a, b] = topRange(paths, sel);
  const slice = (next.content ?? []).slice(a, b + 1);
  const out: Loose[] = [];

  if (slice.every((node) => node.type === kind)) {
    for (const list of slice) for (const item of list.content ?? []) out.push(...(item.content ?? []));
  } else {
    let run: Loose[][] = [];
    const flush = () => {
      if (run.length === 0) return;
      out.push({
        type: kind,
        ...(kind === "orderedList" ? { attrs: { start } } : {}),
        content: run.map((content) => ({ type: "listItem", content })),
      });
      run = [];
    };
    // A quote's lines join the run; a picture or rule inside one ends it.
    const take = (node: Loose) => {
      if (isTextblock(node)) run.push([plain(node)]);
      else {
        flush();
        out.push(node);
      }
    };
    for (const node of slice) {
      if (node.type === "bulletList" || node.type === "orderedList") {
        for (const item of node.content ?? []) run.push(item.content ?? []);
      } else if (node.type === "blockquote") {
        (node.content ?? []).forEach(take);
      } else take(node);
    }
    flush();
  }

  (next.content ?? []).splice(a, b - a + 1, ...out);
  return finish(next, sel);
}

/** Wraps the touched blocks in one quote, or lifts them out of it. */
export function toggleQuote(doc: RichDoc, sel: Sel): Change | null {
  const { next, paths } = begin(doc);
  if (paths.length === 0) return null;
  const [a, b] = topRange(paths, sel);
  const slice = (next.content ?? []).slice(a, b + 1);
  const out: Loose[] = [];

  if (slice.every((node) => node.type === "blockquote")) {
    for (const quote of slice) out.push(...(quote.content ?? []));
  } else {
    let run: Loose[] = [];
    const flush = () => {
      if (run.length > 0) out.push({ type: "blockquote", content: run });
      run = [];
    };
    for (const node of slice) {
      if (node.type === "blockquote") run.push(...(node.content ?? []));
      else if (isAtom(node)) {
        flush();
        out.push(node);
      } else run.push(node);
    }
    flush();
  }

  (next.content ?? []).splice(a, b - a + 1, ...out);
  return finish(next, sel);
}

/* --- inserting blocks ------------------------------------------------------ */

/** Puts a rule or an image after the block the caret is in, and the caret after it. */
export function insertBlock(doc: RichDoc, sel: Sel, block: BlockNode): Change {
  const { next, paths, nodes } = begin(doc);
  const focus = orderedSel(sel).end;
  const path = paths[Math.min(focus.tb, paths.length - 1)] ?? [0];
  const top = path[0];
  const here = (next.content ?? [])[top];
  const content = next.content as Loose[];

  const emptyParagraph =
    path.length === 1 && here?.type === "paragraph" && inlineLength(inlines(nodes[focus.tb] ?? here)) === 0;

  let inserted = top;
  if (emptyParagraph) {
    content.splice(top, 1, asLoose(block), paragraph());
  } else {
    inserted = top + 1;
    const following = content[top + 1];
    content.splice(top + 1, 0, asLoose(block));
    if (!following || isAtom(following)) content.splice(top + 2, 0, paragraph());
  }

  const tb = firstTextblockFrom(next, inserted + 1);
  return finish(next, caret({ tb, off: 0 }));
}

export const dividerBlock = (): BlockNode => ({ type: "horizontalRule" });

export const imageBlock = (attrs: ImageAttrs): BlockNode => ({ type: "image", attrs });

/** Replaces the attributes of the image at a top-level index. */
export function updateImage(doc: RichDoc, sel: Sel, top: number, attrs: ImageAttrs): Change | null {
  const next = asLoose(cloneDoc(doc));
  const node = (next.content ?? [])[top];
  if (!node || node.type !== "image") return null;
  node.attrs = attrs as unknown as Loose["attrs"];
  return { doc: asDoc(next), sel };
}

/** Removes a top-level block (an image or a rule). */
export function removeTopBlock(doc: RichDoc, sel: Sel, top: number): Change | null {
  const next = asLoose(cloneDoc(doc));
  if (!next.content?.[top] || !isAtom(next.content[top])) return null;
  next.content.splice(top, 1);
  const tb = firstTextblockFrom(next, top);
  return finish(next, caret({ tb: Math.max(0, Math.min(tb, sel.focus.tb)), off: 0 }));
}

/* --- editing text --------------------------------------------------------- */

/** Deletes characters `from..to` of one textblock. */
export function deleteChars(doc: RichDoc, tb: number, from: number, to: number): RichDoc {
  const { next, nodes } = begin(doc);
  const node = nodes[tb];
  if (!node) return doc;
  setContent(node, [...sliceInlines(inlines(node), 0, from), ...sliceInlines(inlines(node), to, INF)]);
  return asDoc(next);
}

/** Drops empty containers a deletion may have left behind. */
function prune(node: Loose, removed: Set<Loose>): void {
  node.content = (node.content ?? []).filter((child) => !removed.has(child));
  for (const child of node.content) if (child.content && !isTextblock(child)) prune(child, removed);
  node.content = node.content.filter((child) => !(child.content && !isTextblock(child) && child.content.length === 0));
}

/** Removes the selected range and joins what is left of its two ends. */
export function deleteSelection(doc: RichDoc, sel: Sel): Change {
  if (isCollapsed(sel)) return { doc, sel };
  const { next, nodes, paths } = begin(doc);
  const { start, end } = orderedSel(sel);
  const a = nodes[start.tb];
  const b = nodes[end.tb];

  if (start.tb === end.tb) {
    setContent(a, [...sliceInlines(inlines(a), 0, start.off), ...sliceInlines(inlines(a), end.off, INF)]);
    return { doc: asDoc(next), sel: caret(start) };
  }

  setContent(a, [...sliceInlines(inlines(a), 0, start.off), ...sliceInlines(inlines(b), end.off, INF)]);

  const removed = new Set<Loose>(nodes.slice(start.tb + 1, end.tb + 1));
  const topA = paths[start.tb][0];
  const topB = paths[end.tb][0];
  for (let index = topA + 1; index < topB; index += 1) {
    const between = (next.content ?? [])[index];
    if (between && isAtom(between)) removed.add(between);
  }
  prune(next, removed);
  return finish(next, caret(start));
}

/** Enter. Returns null when there is nothing sensible to do. */
export function splitBlock(doc: RichDoc, sel: Sel): Change | null {
  const collapsed = isCollapsed(sel) ? { doc, sel } : deleteSelection(doc, sel);
  const pos = collapsed.sel.focus;
  const { next, paths, nodes } = begin(collapsed.doc);
  const path = paths[pos.tb];
  const node = nodes[pos.tb];
  if (!path || !node) return null;

  const content = inlines(node);
  const length = inlineLength(content);
  const empty = length === 0;
  const before = sliceInlines(content, 0, pos.off);
  const after = sliceInlines(content, pos.off, INF);
  const parent = nodeAt(next, path.slice(0, -1));
  const index = path[path.length - 1];
  const siblings = parent.content as Loose[];

  if (parent.type === "listItem" || parent.type === "blockquote") {
    if (empty && (parent.type === "blockquote" || siblings.length === 1)) {
      return finish(liftParagraph(next, path), caret({ tb: pos.tb, off: 0 }));
    }
    if (parent.type === "listItem") {
      const list = nodeAt(next, path.slice(0, -2));
      const itemIndex = path[path.length - 2];
      const rest = siblings.splice(index + 1);
      setContent(node, before);
      const fresh: Loose = { type: "listItem", content: [paragraph(after), ...rest] };
      (list.content as Loose[]).splice(itemIndex + 1, 0, fresh);
    } else {
      setContent(node, before);
      siblings.splice(index + 1, 0, paragraph(after));
    }
    return finish(next, caret({ tb: pos.tb + 1, off: 0 }));
  }

  // Top level.
  if (node.type === "heading" && empty) {
    node.type = "paragraph";
    delete node.attrs;
    return finish(next, caret({ tb: pos.tb, off: 0 }));
  }

  setContent(node, before);
  const tail: Loose =
    node.type === "heading" && after.length > 0
      ? { type: "heading", attrs: { ...node.attrs } }
      : { type: "paragraph" };
  setContent(tail, after);
  siblings.splice(index + 1, 0, tail);
  return finish(next, caret({ tb: pos.tb + 1, off: 0 }));
}

/**
 * Takes one paragraph out of the list item or quote that holds it, splitting
 * the container around it. The paragraph keeps its text and its textblock
 * index, so the caret does not move.
 */
function liftParagraph(next: Loose, path: Path): Loose {
  const parent = nodeAt(next, path.slice(0, -1));
  const index = path[path.length - 1];
  const node = (parent.content as Loose[])[index];

  if (parent.type === "blockquote") {
    const quotePath = path.slice(0, -1);
    const holder = nodeAt(next, quotePath.slice(0, -1)).content as Loose[];
    const at = quotePath[quotePath.length - 1];
    const quote = parent.content as Loose[];
    const head = quote.slice(0, index);
    const tail = quote.slice(index + 1);
    holder.splice(
      at,
      1,
      ...(head.length ? [{ type: "blockquote", content: head }] : []),
      plain(node),
      ...(tail.length ? [{ type: "blockquote", content: tail }] : []),
    );
    return next;
  }

  // A list item.
  const itemPath = path.slice(0, -1);
  const listPath = itemPath.slice(0, -1);
  const list = nodeAt(next, listPath);
  const itemIndex = itemPath[itemPath.length - 1];
  const holder = nodeAt(next, listPath.slice(0, -1)).content as Loose[];
  const at = listPath[listPath.length - 1];
  const items = list.content as Loose[];
  const itemBlocks = parent.content as Loose[];
  const leftover = [...itemBlocks.slice(0, index), ...itemBlocks.slice(index + 1)];
  const remake = (slice: Loose[]): Loose[] =>
    slice.length ? [{ ...list, content: slice }] : [];

  holder.splice(
    at,
    1,
    ...remake(items.slice(0, itemIndex)),
    plain(node),
    ...leftover,
    ...remake(items.slice(itemIndex + 1)),
  );
  return next;
}

/** Backspace at the very start of a textblock. Null when the caret is at the start of the document. */
export function joinBackward(doc: RichDoc, sel: Sel): Change | null {
  const pos = sel.focus;
  const { next, paths, nodes } = begin(doc);
  const path = paths[pos.tb];
  const node = nodes[pos.tb];
  if (!path || !node) return null;

  const parent = nodeAt(next, path.slice(0, -1));
  const index = path[path.length - 1];
  const siblings = parent.content as Loose[];

  if (parent.type === "listItem" || parent.type === "blockquote") {
    const previous = siblings[index - 1];
    if (parent.type === "blockquote" && previous && isTextblock(previous)) {
      return mergeInto(next, paths, nodes, pos.tb);
    }
    if (parent.type === "listItem" && index > 0 && previous && isTextblock(previous)) {
      return mergeInto(next, paths, nodes, pos.tb);
    }
    return finish(liftParagraph(next, path), caret({ tb: pos.tb, off: 0 }));
  }

  if (node.type === "heading") {
    node.type = "paragraph";
    delete node.attrs;
    return finish(next, caret({ tb: pos.tb, off: 0 }));
  }

  const previous = siblings[index - 1];
  if (!previous) return null;
  if (isAtom(previous)) {
    // The rule or picture goes; the text stays where it is.
    siblings.splice(index - 1, 1);
    return finish(next, caret({ tb: pos.tb, off: 0 }));
  }
  return mergeInto(next, paths, nodes, pos.tb);
}

/** Appends a textblock to the one before it (in reading order) and removes it. */
function mergeInto(next: Loose, paths: Path[], nodes: Loose[], tb: number): Change | null {
  if (tb === 0) return null;
  const previous = nodes[tb - 1];
  const current = nodes[tb];
  const offset = inlineLength(inlines(previous));
  setContent(previous, [...inlines(previous), ...inlines(current)]);

  const path = paths[tb];
  const parent = nodeAt(next, path.slice(0, -1));
  (parent.content as Loose[]).splice(path[path.length - 1], 1);
  prune(next, new Set());
  return finish(next, caret({ tb: tb - 1, off: offset }));
}

/** Typed or pasted inline content at the caret. */
export function insertInlines(doc: RichDoc, sel: Sel, content: InlineNode[]): Change {
  const cleared = deleteSelection(doc, sel);
  const pos = cleared.sel.focus;
  const { next, nodes } = begin(cleared.doc);
  const node = nodes[pos.tb];
  const before = sliceInlines(inlines(node), 0, pos.off);
  const after = sliceInlines(inlines(node), pos.off, INF);
  setContent(node, [...before, ...content, ...after]);
  return { doc: asDoc(next), sel: caret({ tb: pos.tb, off: pos.off + inlineLength(mergeInlines(content)) }) };
}

/** Pasted blocks at the caret: the current block is split around them. */
export function insertBlocks(doc: RichDoc, sel: Sel, blocks: BlockNode[]): Change {
  const cleared = deleteSelection(doc, sel);
  const pos = cleared.sel.focus;
  const { next, paths, nodes } = begin(cleared.doc);
  const path = paths[pos.tb];
  const top = path[0];
  const content = next.content as Loose[];
  const incoming = blocks.map(asLoose);

  let head: Loose[] = [];
  let tail: Loose[] = [];
  let replaceCount = 1;
  let insertAt = top;

  if (path.length === 1) {
    const node = nodes[pos.tb];
    const before = sliceInlines(inlines(node), 0, pos.off);
    const after = sliceInlines(inlines(node), pos.off, INF);
    if (before.length > 0) {
      const headNode: Loose = { ...node };
      delete headNode.content;
      setContent(headNode, before);
      head = [headNode];
    }
    if (after.length > 0) {
      const tailNode: Loose = { ...node };
      delete tailNode.content;
      setContent(tailNode, after);
      tail = [tailNode];
    }
  } else {
    replaceCount = 0;
    insertAt = top + 1;
  }

  content.splice(insertAt, replaceCount, ...head, ...incoming, ...tail);

  const base = textblockPaths({ type: "doc", content: content.slice(0, insertAt) }).length;
  const inserted = countTextblocks(incoming);
  const headCount = head.length;
  const target = inserted > 0 ? base + headCount + inserted - 1 : base + headCount;
  const done = finish(next, caret({ tb: target, off: 0 }));
  const nodesAfter = textblockNodes(done.doc);
  const tb = Math.min(done.sel.focus.tb, nodesAfter.length - 1);
  return {
    doc: done.doc,
    sel: caret({ tb, off: inserted > 0 ? inlineLength(contentOf(nodesAfter[tb])) : 0 }),
  };
}

export type { MarkType };
