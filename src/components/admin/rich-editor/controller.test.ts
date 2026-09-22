// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RichDoc } from "@/lib/news/shared/rich-text";

import { type Controller, type EditorSnapshot, createController } from "./controller";
import { doc, p } from "./testing";

/**
 * The controller wired to a real (jsdom) surface, driven with the events a
 * browser would send. jsdom has no editing engine: it never turns a keystroke
 * into text, so "typing" here is done by changing a text node and firing the
 * `input` event the browser would have. What this proves is the wiring —
 * which event triggers which transaction, and that composition is left alone.
 * It is not evidence about caret behaviour or IME in a real browser.
 */

let surface: HTMLElement;
let controller: Controller;
let changes: RichDoc[];
let snapshot: EditorSnapshot;

function start(initial: RichDoc) {
  changes = [];
  surface = document.createElement("div");
  document.body.append(surface);
  controller = createController(surface, {
    initialDoc: initial,
    onChange: (next) => changes.push(next),
    onState: (next) => {
      snapshot = next;
    },
    onLink: () => {},
    onImage: () => {},
  });
}

function caretIn(node: Node, offset: number) {
  document.getSelection()!.setBaseAndExtent(node, offset, node, offset);
}

/** What the browser does when a character is typed at the caret. */
function type(text: string, data: string) {
  const node = document.getSelection()!.anchorNode as Text;
  const offset = document.getSelection()!.anchorOffset;
  node.data = node.data.slice(0, offset) + data + node.data.slice(offset);
  caretIn(node, offset + data.length);
  surface.dispatchEvent(new InputEvent("input", { inputType: "insertText", data, bubbles: true }));
  return text;
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  surface.dispatchEvent(event);
  return event;
}

function beforeInput(inputType: string) {
  const event = new InputEvent("beforeinput", { inputType, bubbles: true, cancelable: true });
  surface.dispatchEvent(event);
  return event;
}

const last = () => changes[changes.length - 1];

beforeEach(() => start(doc(p("hello"))));
afterEach(() => {
  controller.destroy();
  surface.remove();
});

describe("start", () => {
  it("renders the document and reports it", () => {
    expect(surface.innerHTML).toBe("<p>hello</p>");
    expect(snapshot.empty).toBe(false);
    expect(snapshot.words).toBe(1);
    expect(last()).toEqual(doc(p("hello")));
  });

  it("does not report a change for a document it merely opened (no false 'unsaved')", () => {
    expect(changes.every((c) => JSON.stringify(c) === JSON.stringify(doc(p("hello"))))).toBe(true);
  });

  it("gives a blank document somewhere to type", () => {
    controller.destroy();
    surface.remove();
    start(doc());
    expect(surface.innerHTML).toBe("<p><br></p>");
    expect(snapshot.empty).toBe(true);
  });
});

describe("Enter", () => {
  it("is taken over: prevented, and done as a split on the document", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 2);
    const event = beforeInput("insertParagraph");
    expect(event.defaultPrevented).toBe(true);
    expect(surface.innerHTML).toBe("<p>he</p><p>llo</p>");
    expect(document.getSelection()!.anchorNode).toBe(surface.querySelectorAll("p")[1].firstChild);
    expect(document.getSelection()!.anchorOffset).toBe(0);
  });

  it("turns --- into a divider and leaves nothing of it", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("---")));
    caretIn(surface.querySelector("p")!.firstChild!, 3);
    beforeInput("insertParagraph");
    expect(surface.querySelector("hr")).not.toBeNull();
    expect(surface.textContent).toBe("");
  });

  it("does nothing while an input method is composing", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 2);
    surface.dispatchEvent(new Event("compositionstart"));
    const event = beforeInput("insertParagraph");
    expect(event.defaultPrevented).toBe(false);
    expect(surface.innerHTML).toBe("<p>hello</p>");
  });
});

describe("Backspace at the start of a block", () => {
  it("joins with the block above, without the browser's help", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("ab"), p("cd")));
    caretIn(surface.querySelectorAll("p")[1].firstChild!, 0);
    const event = beforeInput("deleteContentBackward");
    expect(event.defaultPrevented).toBe(true);
    expect(surface.innerHTML).toBe("<p>abcd</p>");
  });

  it("leaves an ordinary Backspace inside a line to the browser", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 3);
    expect(beforeInput("deleteContentBackward").defaultPrevented).toBe(false);
  });
});

describe("markdown shortcuts", () => {
  it("## then space becomes a heading with the marker consumed", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("##")));
    caretIn(surface.querySelector("p")!.firstChild!, 2);
    type("", " ");
    expect(surface.innerHTML).toBe("<h2><br></h2>");
    expect(surface.textContent).not.toContain("#");
  });

  it("- then space becomes a bullet list", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("-")));
    caretIn(surface.querySelector("p")!.firstChild!, 1);
    type("", " ");
    expect(surface.innerHTML).toBe("<ul><li><br></li></ul>");
  });

  it("**word** becomes bold on the closing asterisk", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("**word*")));
    caretIn(surface.querySelector("p")!.firstChild!, 7);
    type("", "*");
    expect(surface.innerHTML).toBe("<p><strong>word</strong></p>");
  });

  it("ordinary typing does not re-render the surface, so the caret is not moved", () => {
    const text = surface.querySelector("p")!.firstChild!;
    caretIn(text, 5);
    type("", "x");
    expect(surface.querySelector("p")!.firstChild).toBe(text);
    expect(last()).toEqual(doc(p("hellox")));
  });

  it("does not run a shortcut in the middle of an input-method composition", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("##")));
    const text = surface.querySelector("p")!.firstChild as Text;
    caretIn(text, 2);
    surface.dispatchEvent(new Event("compositionstart"));
    type("", " ");
    expect(surface.innerHTML).toBe("<p>## </p>");
    // Composition ends: now the browser's input is read.
    surface.dispatchEvent(new CompositionEvent("compositionend", { data: " " }));
    expect(surface.innerHTML).toBe("<h2><br></h2>");
  });
});

describe("slash menu", () => {
  it("opens on / at the start of a plain line, filters, and applies on pick", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("/")));
    caretIn(surface.querySelector("p")!.firstChild!, 1);
    type("", "ишл");
    expect(snapshot.slash?.items.map((item) => item.id)).toEqual(["quote"]);

    controller.slashPick("quote");
    expect(surface.innerHTML).toBe("<blockquote><p><br></p></blockquote>");
  });

  it("is driven from the keyboard: arrows move, Enter picks, Escape closes", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("/")));
    caretIn(surface.querySelector("p")!.firstChild!, 1);
    surface.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "/", bubbles: true }));
    expect(snapshot.slash?.index).toBe(0);

    press("ArrowDown");
    expect(snapshot.slash?.index).toBe(1);
    press("Enter");
    expect(surface.innerHTML).toBe("<h2><br></h2>");
  });

  it("closes on Escape without changing the text", () => {
    controller.destroy();
    surface.remove();
    start(doc(p("/")));
    caretIn(surface.querySelector("p")!.firstChild!, 1);
    surface.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "/", bubbles: true }));
    expect(snapshot.slash).not.toBeNull();
    press("Escape");
    expect(snapshot.slash).toBeNull();
    expect(surface.textContent).toBe("/");
  });
});

describe("shortcuts and commands", () => {
  function selectAll() {
    const text = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT).nextNode()!;
    document.getSelection()!.setBaseAndExtent(text, 0, text, 5);
  }

  it("Ctrl+B bolds the selection and Ctrl+Z takes it back", () => {
    selectAll();
    expect(press("b", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(surface.innerHTML).toBe("<p><strong>hello</strong></p>");
    press("z", { ctrlKey: true });
    expect(surface.innerHTML).toBe("<p>hello</p>");
    press("z", { ctrlKey: true, shiftKey: true });
    expect(surface.innerHTML).toBe("<p><strong>hello</strong></p>");
  });

  it("uses Cmd as well as Ctrl", () => {
    selectAll();
    press("i", { metaKey: true });
    expect(surface.innerHTML).toBe("<p><em>hello</em></p>");
  });

  it("Ctrl+Shift+X strikes and Ctrl+U underlines", () => {
    selectAll();
    press("x", { ctrlKey: true, shiftKey: true });
    expect(surface.innerHTML).toBe("<p><s>hello</s></p>");
    press("u", { ctrlKey: true });
    expect(surface.innerHTML).toContain("<u>");
  });

  it("reflects the selection in the toolbar state", () => {
    selectAll();
    press("b", { ctrlKey: true });
    selectAll();
    surface.ownerDocument.dispatchEvent(new Event("selectionchange"));
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        expect(snapshot.marks).toContain("bold");
        resolve();
      }),
    );
  });

  it("toolbar commands run against the last known selection", () => {
    selectAll();
    controller.command({ type: "heading", level: 2 });
    expect(surface.innerHTML).toBe("<h2>hello</h2>");
    controller.command({ type: "bullet" });
    expect(surface.innerHTML).toBe("<ul><li>hello</li></ul>");
    controller.command({ type: "clear" });
    expect(snapshot.canUndo).toBe(true);
  });

  it("asks for a link address instead of guessing one", () => {
    let asked = false;
    controller.destroy();
    surface.remove();
    surface = document.createElement("div");
    document.body.append(surface);
    controller = createController(surface, {
      initialDoc: doc(p("hello")),
      onChange: () => {},
      onState: () => {},
      onLink: () => {
        asked = true;
      },
      onImage: () => {},
    });
    press("k", { ctrlKey: true });
    expect(asked).toBe(true);
  });
});

describe("paste and drop", () => {
  function paste(html: string, text: string) {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: (type: string) => (type === "text/html" ? html : text) },
    });
    surface.dispatchEvent(event);
    return event;
  }

  it("is intercepted and converted: markdown text leaves no markers", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 5);
    const event = paste("", "\n\n## Head\n\n- one\n- two\n\n**bold** word");
    expect(event.defaultPrevented).toBe(true);
    expect(surface.textContent).not.toMatch(/#|\*\*|- /u);
    expect(surface.querySelector("h1, h2, h3")).not.toBeNull();
    expect(surface.querySelectorAll("li")).toHaveLength(2);
    expect(surface.querySelector("strong")?.textContent).toBe("bold");
  });

  it("drops scripts, handlers and unsafe links from pasted HTML", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 5);
    paste(
      '<p onclick="x()">safe <a href="javascript:alert(1)">link</a><script>alert(1)</script><img src="data:image/png;base64,AA" onerror="x()"></p>',
      "",
    );
    expect(surface.querySelector("script, img, [onclick]")).toBeNull();
    expect(surface.innerHTML).not.toContain("javascript");
    expect(surface.textContent).toContain("safe link");
  });

  it("refuses a drop of foreign markup as-is, and inserts it sanitised", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 5);
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: {
        getData: (type: string) => (type === "text/html" ? '<p>dropped<img src=x onerror="alert(1)"></p>' : ""),
        types: ["text/html"],
      },
    });
    Object.assign(drop, { clientX: 0, clientY: 0 });
    surface.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(surface.querySelector("img")).toBeNull();
    expect(surface.textContent).toContain("dropped");
  });
});

describe("images", () => {
  it("inserts a picture from the popover's result and lets it be removed by keyboard", () => {
    caretIn(surface.querySelector("p")!.firstChild!, 5);
    controller.applyImage(
      { sel: { anchor: { tb: 0, off: 5 }, focus: { tb: 0, off: 5 } }, top: null, attrs: null },
      { src: "https://example.com/a.jpg", alt: "alt", title: "cap", width: null, height: null },
    );
    const figure = surface.querySelector("figure") as HTMLElement;
    expect(figure).not.toBeNull();
    expect(figure.getAttribute("tabindex")).toBe("0");

    figure.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(snapshot.atom).toBe("image");
    expect(press("Backspace").defaultPrevented).toBe(true);
    expect(surface.querySelector("figure")).toBeNull();
  });
});
