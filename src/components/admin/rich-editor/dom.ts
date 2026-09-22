import {
  type BlockNode,
  type ImageAttrs,
  type InlineNode,
  type Mark,
  type RichDoc,
  sanitizeDoc,
} from "@/lib/news/shared/rich-text";

import { type Pos, type Sel, mergeInlines } from "./model";
import { STRINGS } from "./strings";

/**
 * The bridge between the browser's DOM and a `RichDoc`.
 *
 * `parseDom` is the one converter: the editor runs it on its own surface after
 * every native edit (collapsing nothing, so offsets stay exact), and the paste
 * and drop handlers run it on foreign HTML (collapsing whitespace, dropping
 * empty blocks). Either way the output goes through `sanitizeDoc`, so nothing
 * the DOM contained but the format allows can survive — no scripts, no styles,
 * no event handlers, no unknown tags.
 *
 * Alongside the document it returns a list of *leaves*: every text node and
 * line break in the editor surface, with the textblock and offset it maps to.
 * Selection reading and writing are done against that list, which is what lets
 * the caret survive a re-render and lets the browser keep working with any
 * shape of DOM it produced, rather than one we hoped for.
 */

export type Leaf = {
  node: Node;
  tb: number;
  /** Offset of the leaf's first character inside its textblock. */
  off: number;
  length: number;
  kind: "text" | "br" | "empty";
  block: Element;
};

export type Parsed = {
  doc: RichDoc;
  leaves: Leaf[];
  /** Images and rules that are direct blocks of the document, with their index. */
  atoms: Array<{ el: Element; top: number }>;
};

type Run = { nodes: InlineNode[]; leaves: Array<Omit<Leaf, "tb" | "block">>; length: number };

type Ctx = {
  blocks: BlockNode[];
  run: Run;
  heading: 1 | 2 | 3 | null;
  root: boolean;
};

type State = {
  collapse: boolean;
  tb: number;
  leaves: Leaf[];
  atoms: Parsed["atoms"];
};

const SKIP = new Set([
  "SCRIPT", "STYLE", "HEAD", "TEMPLATE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED", "SVG", "CANVAS",
  "VIDEO", "AUDIO", "SELECT", "OPTION", "BUTTON", "INPUT", "TEXTAREA", "LINK", "META", "TITLE",
]);

const BLOCKISH = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "NAV", "ASIDE", "FORM", "FIELDSET",
  "ADDRESS", "CENTER", "DETAILS", "SUMMARY", "DL", "DT", "DD", "TABLE", "THEAD", "TBODY", "TFOOT",
  "TR", "TD", "TH", "CAPTION", "FIGCAPTION", "PRE", "LI", "BODY", "HTML",
]);

function newRun(): Run {
  return { nodes: [], leaves: [], length: 0 };
}

function marksFor(el: Element, inherited: Mark[]): Mark[] {
  const marks = [...inherited];
  const add = (mark: Mark) => {
    if (!marks.some((m) => m.type === mark.type)) marks.push(mark);
  };
  const style = (el as HTMLElement).style;
  const weight = style?.fontWeight ?? "";
  const normalWeight = weight === "normal" || weight === "400" || weight === "lighter";

  switch (el.tagName) {
    case "B":
    case "STRONG":
      if (!normalWeight) add({ type: "bold" });
      break;
    case "I":
    case "EM":
    case "CITE":
    case "DFN":
      add({ type: "italic" });
      break;
    case "U":
    case "INS":
      add({ type: "underline" });
      break;
    case "S":
    case "STRIKE":
    case "DEL":
      add({ type: "strike" });
      break;
    case "A": {
      const href = el.getAttribute("href");
      if (href) {
        add({ type: "link", attrs: { href, target: el.getAttribute("target") === "_blank" ? "_blank" : null } });
      }
      break;
    }
  }

  if (/^(bold|bolder|[6-9]00)$/u.test(weight)) add({ type: "bold" });
  if (/italic|oblique/u.test(style?.fontStyle ?? "")) add({ type: "italic" });
  const decoration = `${style?.textDecorationLine ?? ""} ${style?.textDecoration ?? ""}`;
  if (/underline/u.test(decoration)) add({ type: "underline" });
  if (/line-through/u.test(decoration)) add({ type: "strike" });
  return marks;
}

function pushText(state: State, ctx: Ctx, node: Text, marks: Mark[]) {
  let text = node.data.replace(/ /gu, " ");
  if (state.collapse) text = text.replace(/[\s]+/gu, " ");
  if (!text) return;
  ctx.run.nodes.push(marks.length > 0 ? { type: "text", text, marks } : { type: "text", text });
  ctx.run.leaves.push({ node, off: ctx.run.length, length: text.length, kind: "text" });
  ctx.run.length += text.length;
}

function flushRun(state: State, ctx: Ctx, el: Element, force: boolean) {
  const run = ctx.run;
  ctx.run = newRun();

  // A trailing <br> is the browser's placeholder for an empty line, not a line
  // break the editor typed — exactly one is discarded. The renderer writes an
  // extra one after a real trailing break, so the two round-trip.
  if (run.nodes[run.nodes.length - 1]?.type === "hardBreak") {
    run.nodes.pop();
    const last = run.leaves[run.leaves.length - 1];
    if (last?.kind === "br") run.leaves.pop();
  }

  if (state.collapse) {
    const first = run.nodes[0];
    if (first?.type === "text") run.nodes[0] = { ...first, text: first.text.replace(/^\s+/u, "") };
    const last = run.nodes[run.nodes.length - 1];
    if (last?.type === "text") run.nodes[run.nodes.length - 1] = { ...last, text: last.text.replace(/\s+$/u, "") };
    if (run.nodes.every((node) => node.type === "text" && !node.text)) run.nodes = [];
  }

  if (run.nodes.length === 0 && !force) return;

  const tb = state.tb;
  state.tb += 1;
  const content = state.collapse ? mergeInlines(run.nodes) : run.nodes;
  const block: BlockNode = ctx.heading
    ? { type: "heading", attrs: { level: ctx.heading }, ...(content.length ? { content } : {}) }
    : { type: "paragraph", ...(content.length ? { content } : {}) };
  ctx.blocks.push(block);

  if (run.leaves.length === 0) {
    state.leaves.push({ node: el, tb, off: 0, length: 0, kind: "empty", block: el });
  } else {
    for (const leaf of run.leaves) state.leaves.push({ ...leaf, tb, block: el });
  }
}

function imageFrom(el: Element): ImageAttrs | null {
  const packed = el.getAttribute("data-image");
  if (packed) {
    try {
      return JSON.parse(packed) as ImageAttrs;
    } catch {
      // Fall through to the attributes.
    }
  }
  const img = el.tagName === "IMG" ? el : el.querySelector("img");
  if (!img) return null;
  const caption = el.tagName === "FIGURE" ? el.querySelector("figcaption")?.textContent?.trim() : "";
  return {
    src: img.getAttribute("src") ?? "",
    alt: img.getAttribute("alt") ?? "",
    title: img.getAttribute("title") || caption || null,
    width: Number(img.getAttribute("width")) || null,
    height: Number(img.getAttribute("height")) || null,
  };
}

function pushAtom(state: State, ctx: Ctx, el: Element, block: BlockNode) {
  ctx.blocks.push(block);
  if (ctx.root) state.atoms.push({ el, top: ctx.blocks.length - 1 });
}

function walk(state: State, ctx: Ctx, parent: Node, marks: Mark[], owner: Element) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3) {
      pushText(state, ctx, child as Text, marks);
      continue;
    }
    if (child.nodeType !== 1) continue;

    const el = child as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP.has(tag)) continue;

    if (tag === "BR") {
      ctx.run.nodes.push({ type: "hardBreak" });
      ctx.run.leaves.push({ node: el, off: ctx.run.length, length: 1, kind: "br" });
      ctx.run.length += 1;
      continue;
    }

    if (tag === "HR") {
      flushRun(state, ctx, owner, false);
      pushAtom(state, ctx, el, { type: "horizontalRule" });
      continue;
    }

    if (tag === "IMG" || tag === "FIGURE") {
      flushRun(state, ctx, owner, false);
      const attrs = imageFrom(el);
      if (attrs) pushAtom(state, ctx, el, { type: "image", attrs });
      continue;
    }

    if (tag === "UL" || tag === "OL") {
      flushRun(state, ctx, owner, false);
      const items: Array<{ type: "listItem"; content: BlockNode[] }> = [];
      for (const item of Array.from(el.children)) {
        if (item.tagName.toUpperCase() !== "LI") continue;
        const sub: Ctx = { blocks: [], run: newRun(), heading: null, root: false };
        walk(state, sub, item, marks, item);
        flushRun(state, sub, item, !state.collapse && sub.blocks.length === 0);
        if (sub.blocks.length > 0) items.push({ type: "listItem", content: sub.blocks });
      }
      if (items.length > 0) {
        ctx.blocks.push(
          tag === "UL"
            ? { type: "bulletList", content: items }
            : {
                type: "orderedList",
                attrs: { start: Number.parseInt(el.getAttribute("start") ?? "1", 10) || 1 },
                content: items,
              },
        );
      }
      continue;
    }

    if (tag === "BLOCKQUOTE") {
      flushRun(state, ctx, owner, false);
      const sub: Ctx = { blocks: [], run: newRun(), heading: null, root: false };
      walk(state, sub, el, marks, el);
      flushRun(state, sub, el, !state.collapse && sub.blocks.length === 0);
      if (sub.blocks.length > 0) ctx.blocks.push({ type: "blockquote", content: sub.blocks });
      continue;
    }

    const heading = /^H([1-6])$/u.exec(tag);
    if (heading || BLOCKISH.has(tag)) {
      flushRun(state, ctx, owner, false);
      const saved = ctx.heading;
      if (heading) ctx.heading = Math.min(3, Number(heading[1])) as 1 | 2 | 3;
      const before = ctx.blocks.length;
      const start = state.tb;
      walk(state, ctx, el, marks, el);
      // An empty line is a real, empty block in the editor; on paste it is noise.
      flushRun(state, ctx, el, !state.collapse && ctx.blocks.length === before && state.tb === start);
      ctx.heading = saved;
      continue;
    }

    walk(state, ctx, el, marksFor(el, marks), owner);
  }
}

/** Reads a DOM subtree into a sanitised document, plus the caret-mapping leaves. */
export function parseDom(root: Element, options: { collapse?: boolean } = {}): Parsed {
  const state: State = { collapse: Boolean(options.collapse), tb: 0, leaves: [], atoms: [] };
  const ctx: Ctx = { blocks: [], run: newRun(), heading: null, root: true };
  walk(state, ctx, root, [], root);
  flushRun(state, ctx, root, false);
  return {
    doc: sanitizeDoc({ type: "doc", content: ctx.blocks }),
    leaves: state.leaves,
    atoms: state.atoms,
  };
}

/** Foreign HTML (paste, drop) to a document. Parsed inert: nothing loads or runs. */
export function htmlToDoc(html: string): RichDoc {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return parseDom(parsed.body, { collapse: true }).doc;
}

/* --- rendering -------------------------------------------------------------- */

function inlineNodes(doc: Document, content: InlineNode[] | undefined, out: Node[]): void {
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      out.push(doc.createElement("br"));
      continue;
    }
    let el: Node = doc.createTextNode(node.text);
    // First mark outermost, so parsing the DOM back yields the same order.
    for (const mark of [...(node.marks ?? [])].reverse()) {
      let wrapper: HTMLElement;
      switch (mark.type) {
        case "bold":
          wrapper = doc.createElement("strong");
          break;
        case "italic":
          wrapper = doc.createElement("em");
          break;
        case "underline":
          wrapper = doc.createElement("u");
          break;
        case "strike":
          wrapper = doc.createElement("s");
          break;
        case "link":
          wrapper = doc.createElement("a");
          wrapper.setAttribute("href", mark.attrs.href);
          if (mark.attrs.target) wrapper.setAttribute("target", mark.attrs.target);
          break;
      }
      wrapper.appendChild(el);
      el = wrapper;
    }
    out.push(el);
  }
  // A trailing break or an empty block needs a placeholder for the caret.
  const last = content?.[content.length - 1];
  if (!content?.length || last?.type === "hardBreak") out.push(doc.createElement("br"));
}

function renderBlock(doc: Document, block: BlockNode): HTMLElement {
  switch (block.type) {
    case "paragraph": {
      const el = doc.createElement("p");
      const kids: Node[] = [];
      inlineNodes(doc, block.content, kids);
      el.append(...kids);
      return el;
    }
    case "heading": {
      const el = doc.createElement(`h${block.attrs.level}`);
      const kids: Node[] = [];
      inlineNodes(doc, block.content, kids);
      el.append(...kids);
      return el;
    }
    case "bulletList":
    case "orderedList": {
      const el = doc.createElement(block.type === "bulletList" ? "ul" : "ol");
      if (block.type === "orderedList" && block.attrs.start !== 1) {
        el.setAttribute("start", String(block.attrs.start));
      }
      for (const item of block.content) {
        const li = doc.createElement("li");
        const only = item.content.length === 1 ? item.content[0] : null;
        if (only?.type === "paragraph") {
          const kids: Node[] = [];
          inlineNodes(doc, only.content, kids);
          li.append(...kids);
        } else {
          li.append(...item.content.map((child) => renderBlock(doc, child)));
        }
        el.append(li);
      }
      return el;
    }
    case "blockquote": {
      const el = doc.createElement("blockquote");
      el.append(...block.content.map((child) => renderBlock(doc, child)));
      return el;
    }
    case "image": {
      const figure = doc.createElement("figure");
      figure.setAttribute("contenteditable", "false");
      figure.setAttribute("data-atom", "image");
      // Focusable, so a keyboard can reach a picture to edit or delete it.
      figure.setAttribute("tabindex", "0");
      figure.setAttribute("role", "img");
      figure.setAttribute("aria-label", block.attrs.alt || STRINGS.imageAtom);
      figure.setAttribute("data-image", JSON.stringify(block.attrs));
      const img = doc.createElement("img");
      img.setAttribute("src", block.attrs.src);
      img.setAttribute("alt", block.attrs.alt);
      img.setAttribute("draggable", "false");
      figure.append(img);
      if (block.attrs.title) {
        const caption = doc.createElement("figcaption");
        caption.textContent = block.attrs.title;
        figure.append(caption);
      }
      return figure;
    }
    case "horizontalRule": {
      const hr = doc.createElement("hr");
      hr.setAttribute("contenteditable", "false");
      hr.setAttribute("data-atom", "hr");
      hr.setAttribute("tabindex", "0");
      hr.setAttribute("aria-label", STRINGS.dividerAtom);
      return hr;
    }
  }
}

/** Replaces the surface's children with the document. Text goes in as text nodes, never as markup. */
export function renderDoc(docModel: RichDoc, root: HTMLElement): void {
  const doc = root.ownerDocument;
  root.replaceChildren(...docModel.content.map((block) => renderBlock(doc, block)));
}

/* --- selection ---------------------------------------------------------------- */

function anchorOf(leaf: Leaf): [Node, number] {
  if (leaf.kind === "br") {
    const parent = leaf.node.parentNode as Node;
    return [parent, Array.prototype.indexOf.call(parent.childNodes, leaf.node)];
  }
  return [leaf.node, 0];
}

/** A DOM point as a document position. */
export function posFromPoint(leaves: Leaf[], node: Node, offset: number): Pos {
  if (leaves.length === 0) return { tb: 0, off: 0 };

  if (node.nodeType === 3) {
    const leaf = leaves.find((entry) => entry.node === node);
    if (leaf) return { tb: leaf.tb, off: leaf.off + Math.min(offset, leaf.length) };
  }

  const range = node.ownerDocument!.createRange();
  range.setStart(node, offset);
  range.collapse(true);

  const next = leaves.findIndex((leaf) => {
    const [anchorNode, anchorOffset] = anchorOf(leaf);
    try {
      return range.comparePoint(anchorNode, anchorOffset) >= 0;
    } catch {
      return false;
    }
  });

  const previous = next === -1 ? leaves[leaves.length - 1] : leaves[next - 1];
  const following = next === -1 ? null : leaves[next];

  // A point inside the block the previous leaf belongs to is the end of that
  // block's text, not the start of the next block's.
  if (previous && (following === null || previous.block.contains(node))) {
    return { tb: previous.tb, off: previous.off + previous.length };
  }
  return following ? { tb: following.tb, off: following.off } : { tb: 0, off: 0 };
}

/** A document position as a DOM point. */
export function pointFromPos(leaves: Leaf[], pos: Pos): { node: Node; offset: number } | null {
  const inBlock = leaves.filter((leaf) => leaf.tb === pos.tb);
  for (const leaf of inBlock) {
    if (leaf.kind === "empty") return { node: leaf.node, offset: 0 };
    if (leaf.kind === "text" && pos.off >= leaf.off && pos.off <= leaf.off + leaf.length) {
      return { node: leaf.node, offset: pos.off - leaf.off };
    }
    if (leaf.kind === "br") {
      const parent = leaf.node.parentNode as Node;
      const index = Array.prototype.indexOf.call(parent.childNodes, leaf.node) as number;
      if (pos.off <= leaf.off) return { node: parent, offset: index };
      if (pos.off === leaf.off + 1 && leaf === inBlock[inBlock.length - 1]) {
        return { node: parent, offset: index + 1 };
      }
    }
  }
  const last = inBlock[inBlock.length - 1];
  if (!last) return null;
  if (last.kind === "text") return { node: last.node, offset: last.length };
  return { node: last.block, offset: last.block.childNodes.length };
}

export function readSelection(root: HTMLElement, leaves: Leaf[]): Sel | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
  return {
    anchor: posFromPoint(leaves, selection.anchorNode, selection.anchorOffset),
    focus: posFromPoint(leaves, selection.focusNode, selection.focusOffset),
  };
}

export function writeSelection(root: HTMLElement, leaves: Leaf[], sel: Sel): void {
  const selection = root.ownerDocument.getSelection();
  const anchor = pointFromPos(leaves, sel.anchor);
  const focus = pointFromPos(leaves, sel.focus);
  if (!selection || !anchor || !focus) return;
  selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}
