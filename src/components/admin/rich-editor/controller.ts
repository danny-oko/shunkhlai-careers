import { type ImageAttrs, type RichDoc, docText, readingMinutes, wordCount } from "@/lib/news/shared/rich-text";

import {
  clearFormatting,
  dividerBlock,
  imageBlock,
  insertBlock,
  joinBackward,
  linkAt,
  prepareDoc,
  removeTopBlock,
  setBlockType,
  setLink,
  splitBlock,
  toggleList,
  toggleMark,
  toggleQuote,
  updateImage,
} from "./commands";
import { type Leaf, type Parsed, parseDom, readSelection, renderDoc, writeSelection } from "./dom";
import { History } from "./history";
import {
  type ActiveState,
  type Change,
  type Sel,
  type SimpleMark,
  activeState,
  caret,
  cleanForSave,
} from "./model";
import { clipboardToDoc, pasteInto } from "./paste";
import {
  type SlashId,
  type SlashItem,
  applyBlockShortcut,
  applyDividerShortcut,
  applyInlineShortcut,
  clearSlash,
  filterSlashItems,
  slashQuery,
} from "./shortcuts";

/**
 * The editor's state model, and the reason it is built the way it is.
 *
 * The document is owned as a `RichDoc`. The DOM is a view of it that the
 * browser is also allowed to edit: ordinary typing, deleting inside a line,
 * spell-check, IME composition and cut all happen natively, and after each one
 * the surface is read back into a document with a strict allow-listing
 * converter (`parseDom`). Everything that is *structural* — Enter, Backspace at
 * the start of a block, every toolbar and slash command, the markdown
 * shortcuts, paste, drop, undo and redo — is intercepted (`beforeinput`,
 * `keydown`, `paste`, `drop`) and done as a pure transaction on the document
 * (`commands.ts`), after which the surface is re-rendered and the caret put
 * back from a `{ textblock, offset }` position.
 *
 * Two rules keep that safe. The surface is never re-rendered during IME
 * composition (that would cancel the composition; Mongolian Cyrillic through an
 * input method depends on this), and plain typing never re-renders it either,
 * so the caret is never moved out from under the writer. Only a structural
 * change replaces the DOM.
 *
 * This file is plain TypeScript with no React in it: the component only wires
 * it to a `<div>` and renders its published snapshots.
 */

export type Command =
  | { type: "mark"; mark: SimpleMark }
  | { type: "heading"; level: 0 | 1 | 2 | 3 }
  | { type: "bullet" }
  | { type: "numbered" }
  | { type: "quote" }
  | { type: "divider" }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "link" }
  | { type: "image" };

export type SlashState = { items: SlashItem[]; index: number; top: number; left: number };

export type EditorSnapshot = {
  marks: string[];
  link: ActiveState["link"];
  heading: ActiveState["heading"];
  list: ActiveState["list"];
  quote: boolean;
  canHeading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  empty: boolean;
  words: number;
  minutes: number;
  slash: SlashState | null;
  atom: "image" | "hr" | null;
};

export const EMPTY_SNAPSHOT: EditorSnapshot = {
  marks: [],
  link: null,
  heading: 0,
  list: null,
  quote: false,
  canHeading: true,
  canUndo: false,
  canRedo: false,
  empty: true,
  words: 0,
  minutes: 1,
  slash: null,
  atom: null,
};

export type LinkRequest = { sel: Sel; current: { href: string; target: "_blank" | null } | null };
export type ImageRequest = { sel: Sel; top: number | null; attrs: ImageAttrs | null };

export type Controller = {
  destroy(): void;
  focus(): void;
  command(command: Command): void;
  applyLink(sel: Sel, link: { href: string; target: "_blank" | null } | null): void;
  applyImage(request: ImageRequest, attrs: ImageAttrs): void;
  removeImage(request: ImageRequest): void;
  slashMove(delta: number): void;
  slashPick(id: SlashId): void;
  getDoc(): RichDoc;
};

export type Options = {
  initialDoc: RichDoc;
  onChange(doc: RichDoc): void;
  onState(snapshot: EditorSnapshot): void;
  onLink(request: LinkRequest): void;
  onImage(request: ImageRequest): void;
};

const MAX_PASTE_HTML = 1_500_000;

function isEmptyDoc(doc: RichDoc): boolean {
  return doc.content.length === 1 && doc.content[0].type === "paragraph" && !doc.content[0].content?.length;
}

export function createController(surface: HTMLElement, options: Options): Controller {
  const ownerDoc = surface.ownerDocument;

  let doc = prepareDoc(options.initialDoc);
  let leaves: Leaf[] = [];
  let atoms: Parsed["atoms"] = [];
  let lastSel: Sel | null = null;
  let composing = false;
  let selectedAtom: number | null = null;
  let slashIndex = 0;
  let slashDismissed: string | null = null;
  let lastPublished = "";

  const history = new History({ doc, sel: caret({ tb: 0, off: 0 }) });

  /* --- reading and writing the surface ------------------------------------ */

  function readSurface(): void {
    const parsed = parseDom(surface);
    // Nothing left to type into (select-all + delete can empty the surface).
    if (surface.childNodes.length === 0 || parsed.leaves.length === 0) {
      render(prepareDoc({ type: "doc", content: [{ type: "paragraph" }] }), caret({ tb: 0, off: 0 }));
      return;
    }
    doc = parsed.doc;
    leaves = parsed.leaves;
    atoms = parsed.atoms;
  }

  function render(next: RichDoc, sel: Sel | null): void {
    renderDoc(next, surface);
    const parsed = parseDom(surface);
    doc = parsed.doc;
    leaves = parsed.leaves;
    atoms = parsed.atoms;
    selectedAtom = null;
    if (sel) {
      writeSelection(surface, leaves, sel);
      lastSel = sel;
    }
  }

  function currentSel(): Sel | null {
    return readSelection(surface, leaves) ?? lastSel;
  }

  function endOfDoc(): Sel {
    const tb = Math.max(0, new Set(leaves.map((leaf) => leaf.tb)).size - 1);
    return caret({ tb, off: 0 });
  }

  /* --- publishing state ---------------------------------------------------- */

  function slashState(sel: Sel | null): SlashState | null {
    if (!sel) return null;
    const open = slashQuery(doc, sel);
    if (!open) {
      slashDismissed = null;
      return null;
    }
    if (slashDismissed === `${open.tb}:${open.query}`) return null;

    const items = filterSlashItems(open.query);
    const block = leaves.find((leaf) => leaf.tb === open.tb)?.block as HTMLElement | undefined;
    const top = (block?.offsetTop ?? 0) + (block?.offsetHeight ?? 0) + 4;
    return { items, index: Math.min(slashIndex, Math.max(0, items.length - 1)), top, left: block?.offsetLeft ?? 0 };
  }

  function publish(): void {
    const sel = composing ? null : currentSel();
    const state = sel ? activeState(doc, sel) : null;
    const text = docText(doc);
    const atom = selectedAtom === null ? null : (doc.content[selectedAtom]?.type === "image" ? "image" : "hr");

    const snapshot: EditorSnapshot = {
      marks: state ? [...state.marks].sort() : [],
      link: state?.link ?? null,
      heading: state ? state.heading : 0,
      list: state?.list ?? null,
      quote: state?.quote ?? false,
      canHeading: state?.canHeading ?? true,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      empty: isEmptyDoc(doc),
      words: wordCount(text),
      minutes: readingMinutes(text),
      slash: composing ? null : slashState(sel),
      atom,
    };

    const key = JSON.stringify(snapshot);
    if (key === lastPublished) return;
    lastPublished = key;
    options.onState(snapshot);
  }

  function emit(): void {
    options.onChange(cleanForSave(doc));
    publish();
  }

  /* --- transactions -------------------------------------------------------- */

  function commit(change: Change, typing = false): void {
    render(change.doc, change.sel);
    history.push({ doc, sel: change.sel }, { typing });
    emit();
  }

  /** Reads the DOM, then runs `fn` on the fresh document and selection. */
  function transact(fn: (sel: Sel) => Change | null, sel?: Sel | null): boolean {
    readSurface();
    const at = sel ?? currentSel() ?? endOfDoc();
    const change = fn(at);
    if (!change) return false;
    history.breakTyping();
    commit(change);
    if (ownerDoc.activeElement !== surface) surface.focus({ preventScroll: true });
    writeSelection(surface, leaves, change.sel);
    return true;
  }

  function undo(): void {
    const snapshot = history.undo();
    if (!snapshot) return;
    render(snapshot.doc, snapshot.sel);
    emit();
  }

  function redo(): void {
    const snapshot = history.redo();
    if (!snapshot) return;
    render(snapshot.doc, snapshot.sel);
    emit();
  }

  function run(command: Command): void {
    switch (command.type) {
      case "undo":
        return undo();
      case "redo":
        return redo();
      case "mark":
        transact((sel) => toggleMark(doc, sel, command.mark));
        return;
      case "heading":
        transact((sel) => setBlockType(doc, sel, command.level));
        return;
      case "bullet":
        transact((sel) => toggleList(doc, sel, "bulletList"));
        return;
      case "numbered":
        transact((sel) => toggleList(doc, sel, "orderedList"));
        return;
      case "quote":
        transact((sel) => toggleQuote(doc, sel));
        return;
      case "divider":
        transact((sel) => insertBlock(doc, sel, dividerBlock()));
        return;
      case "clear":
        transact((sel) => clearFormatting(doc, sel));
        return;
      case "link": {
        readSurface();
        const sel = currentSel() ?? endOfDoc();
        options.onLink({ sel, current: linkAt(doc, sel.focus) });
        return;
      }
      case "image": {
        readSurface();
        options.onImage({ sel: currentSel() ?? endOfDoc(), top: null, attrs: null });
        return;
      }
    }
  }

  /* --- events -------------------------------------------------------------- */

  function handleEnter(): void {
    transact((sel) => {
      if (sel.anchor.tb === sel.focus.tb && sel.anchor.off === sel.focus.off) {
        const rule = applyDividerShortcut(doc, sel);
        if (rule) return rule;
      }
      return splitBlock(doc, sel);
    });
  }

  function onBeforeInput(event: InputEvent): void {
    if (composing || event.isComposing) return;

    switch (event.inputType) {
      case "insertParagraph":
        event.preventDefault();
        handleEnter();
        return;

      case "deleteContentBackward": {
        readSurface();
        const sel = currentSel();
        if (!sel || sel.anchor.tb !== sel.focus.tb || sel.anchor.off !== sel.focus.off || sel.focus.off !== 0) return;
        event.preventDefault();
        transact((at) => joinBackward(doc, at));
        return;
      }

      case "historyUndo":
        event.preventDefault();
        undo();
        return;
      case "historyRedo":
        event.preventDefault();
        redo();
        return;

      // Paste and drop are handled in their own events, through the sanitiser.
      // If the browser still sends these, refuse rather than let raw markup in.
      case "insertFromPaste":
      case "insertFromPasteAsQuotation":
      case "insertFromDrop":
      case "insertFromYank":
        event.preventDefault();
        return;
    }
  }

  /**
   * Reads the surface after a native edit. `data` is the character the edit
   * ended on, when there was one: shortcuts fire only on the keystroke that
   * completes them (a space, or a closing `*` / `~`), never on a deletion that
   * merely leaves the same text behind.
   */
  function afterEdit(data: string | null): void {
    readSurface();
    const sel = currentSel();
    history.push({ doc, sel: sel ?? caret({ tb: 0, off: 0 }) }, { typing: true });

    let change: Change | null = null;
    if (sel) {
      if (data === " ") change = applyBlockShortcut(doc, sel);
      else if (data === "*" || data === "~") change = applyInlineShortcut(doc, sel);
    }
    if (change) {
      history.breakTyping();
      commit(change);
      return;
    }
    slashIndex = 0;
    emit();
  }

  function onInput(event: Event): void {
    if (composing) return;
    const input = event as InputEvent;
    afterEdit(input.inputType === "insertText" ? input.data : null);
  }

  // Phone keyboards compose nearly every word, so the shortcuts have to work
  // on what a composition commits as well as on plain keystrokes.
  function onCompositionEnd(event: CompositionEvent): void {
    composing = false;
    afterEdit((event.data ?? "").slice(-1) || null);
  }

  function insertPasted(payload: { html?: string; text?: string }): void {
    const html = payload.html && payload.html.length <= MAX_PASTE_HTML ? payload.html : undefined;
    const pasted = clipboardToDoc({ html, text: payload.text });
    transact((sel) => pasteInto(doc, sel, pasted));
  }

  function onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const data = event.clipboardData;
    if (!data) return;
    insertPasted({ html: data.getData("text/html"), text: data.getData("text/plain") });
  }

  function onDragOver(event: DragEvent): void {
    const types = Array.from(event.dataTransfer?.types ?? []);
    if (types.includes("text/html") || types.includes("text/plain")) event.preventDefault();
  }

  function onDrop(event: DragEvent): void {
    // Always cancelled: the browser would otherwise insert the dragged markup
    // as it is. What was dragged goes through the same sanitiser as a paste.
    event.preventDefault();
    const data = event.dataTransfer;
    if (!data) return;
    const html = data.getData("text/html");
    const text = data.getData("text/plain");
    if (!html && !text) return;

    const at = caretFromPoint(event.clientX, event.clientY);
    readSurface();
    if (at) {
      const selection = ownerDoc.getSelection();
      selection?.setBaseAndExtent(at.node, at.offset, at.node, at.offset);
    }
    insertPasted({ html, text });
  }

  function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
    const anyDoc = ownerDoc as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const position = anyDoc.caretPositionFromPoint?.(x, y);
    if (position && surface.contains(position.offsetNode)) return { node: position.offsetNode, offset: position.offset };
    const range = anyDoc.caretRangeFromPoint?.(x, y);
    if (range && surface.contains(range.startContainer)) return { node: range.startContainer, offset: range.startOffset };
    return null;
  }

  function slashPick(id: SlashId): void {
    readSurface();
    const sel = currentSel();
    const open = sel ? slashQuery(doc, sel) : null;
    if (!sel || !open) return;

    const cleared = clearSlash(doc, open.tb);
    const at = caret({ tb: open.tb, off: 0 });
    const change: Change | null = (() => {
      switch (id) {
        case "heading1":
          return setBlockType(cleared, at, 1);
        case "heading2":
          return setBlockType(cleared, at, 2);
        case "heading3":
          return setBlockType(cleared, at, 3);
        case "bullet":
          return toggleList(cleared, at, "bulletList");
        case "numbered":
          return toggleList(cleared, at, "orderedList");
        case "quote":
          return toggleQuote(cleared, at);
        case "divider":
          return insertBlock(cleared, at, dividerBlock());
        case "image":
          return { doc: cleared, sel: at };
      }
    })();
    if (!change) return;

    history.breakTyping();
    commit(change);
    slashDismissed = null;
    if (id === "image") options.onImage({ sel: change.sel, top: null, attrs: null });
    else {
      surface.focus({ preventScroll: true });
      writeSelection(surface, leaves, change.sel);
    }
  }

  function slashMove(delta: number): void {
    const state = slashState(currentSel());
    if (!state || state.items.length === 0) return;
    slashIndex = (state.index + delta + state.items.length) % state.items.length;
    lastPublished = "";
    publish();
  }

  function selectAtom(target: EventTarget | null): void {
    const el = target instanceof Element ? target.closest("[data-atom]") : null;
    surface.querySelectorAll("[data-selected]").forEach((node) => node.removeAttribute("data-selected"));
    selectedAtom = null;
    if (el && surface.contains(el)) {
      readSurface();
      const found = atoms.find((atom) => atom.el === el);
      if (found) {
        selectedAtom = found.top;
        el.setAttribute("data-selected", "");
      }
    }
    publish();
  }

  function openAtomEditor(): void {
    if (selectedAtom === null) return;
    const block = doc.content[selectedAtom];
    if (block?.type !== "image") return;
    options.onImage({ sel: currentSel() ?? endOfDoc(), top: selectedAtom, attrs: block.attrs });
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (composing || event.isComposing || event.keyCode === 229) return;

    const state = slashState(currentSel());
    if (state) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        slashMove(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && state.items.length > 0) {
        event.preventDefault();
        slashPick(state.items[state.index].id);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const open = slashQuery(doc, currentSel()!);
        slashDismissed = open ? `${open.tb}:${open.query}` : null;
        lastPublished = "";
        publish();
        return;
      }
    }

    if (selectedAtom !== null) {
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        const top = selectedAtom;
        transact((sel) => removeTopBlock(doc, sel, top));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        openAtomEditor();
        return;
      }
    }

    const mod = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (!mod) return;

    const key = event.key.toLowerCase();
    const handled = (() => {
      if (key === "b") return run({ type: "mark", mark: "bold" });
      if (key === "i") return run({ type: "mark", mark: "italic" });
      if (key === "u") return run({ type: "mark", mark: "underline" });
      if (key === "k") return run({ type: "link" });
      if (key === "x" && event.shiftKey) return run({ type: "mark", mark: "strike" });
      if (key === "z") return run({ type: event.shiftKey ? "redo" : "undo" });
      if (key === "y") return run({ type: "redo" });
      return false;
    })();
    if (handled !== false) event.preventDefault();
  }

  let selectionFrame = 0;
  function onSelectionChange(): void {
    if (composing) return;
    const selection = ownerDoc.getSelection();
    if (!selection?.anchorNode || !surface.contains(selection.anchorNode)) return;
    cancelAnimationFrame(selectionFrame);
    selectionFrame = requestAnimationFrame(() => {
      const sel = readSelection(surface, leaves);
      if (sel) lastSel = sel;
      publish();
    });
  }

  const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
    surface.addEventListener(type, handler as EventListener);
    return () => surface.removeEventListener(type, handler as EventListener);
  };

  const cleanups = [
    on("beforeinput", onBeforeInput),
    on("input", onInput),
    on("compositionstart", () => {
      composing = true;
    }),
    on("compositionend", onCompositionEnd),
    on("keydown", onKeyDown),
    on("paste", onPaste),
    on("dragover", onDragOver),
    on("drop", onDrop),
    on("click", (event) => selectAtom(event.target)),
    on("focusin", (event) => {
      if ((event.target as Element).closest?.("[data-atom]")) selectAtom(event.target);
    }),
    on("blur", () => history.breakTyping()),
  ];
  ownerDoc.addEventListener("selectionchange", onSelectionChange);

  /* --- start ---------------------------------------------------------------- */

  render(doc, null);
  history.push({ doc, sel: caret({ tb: 0, off: 0 }) });
  emit();

  return {
    destroy() {
      cancelAnimationFrame(selectionFrame);
      ownerDoc.removeEventListener("selectionchange", onSelectionChange);
      for (const cleanup of cleanups) cleanup();
    },
    focus() {
      surface.focus({ preventScroll: true });
    },
    command: run,
    applyLink(sel, link) {
      transact((at) => setLink(doc, at, link), sel);
    },
    applyImage(request, attrs) {
      transact(
        (sel) => (request.top === null ? insertBlock(doc, sel, imageBlock(attrs)) : updateImage(doc, sel, request.top, attrs)),
        request.sel,
      );
    },
    removeImage(request) {
      if (request.top === null) return;
      const top = request.top;
      transact((sel) => removeTopBlock(doc, sel, top), request.sel);
    },
    slashMove,
    slashPick,
    getDoc: () => doc,
  };
}
