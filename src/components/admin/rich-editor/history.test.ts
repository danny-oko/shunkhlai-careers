import { describe, expect, it } from "vitest";

import { History } from "./history";
import { at, doc, p } from "./testing";

const snap = (text: string) => ({ doc: doc(p(text)), sel: at(0, text.length) });

describe("History", () => {
  it("undoes and redoes whole steps", () => {
    const h = new History(snap(""));
    h.push(snap("a"), { now: 0 });
    h.push(snap("ab"), { now: 5000 });

    expect(h.undo()?.doc).toEqual(doc(p("a")));
    expect(h.undo()?.doc).toEqual(doc(p("")));
    expect(h.undo()).toBeNull();
    expect(h.redo()?.doc).toEqual(doc(p("a")));
    expect(h.canRedo).toBe(true);
  });

  it("merges a burst of typing into one step", () => {
    const h = new History(snap(""));
    h.push(snap("a"), { typing: true, now: 0 });
    h.push(snap("ab"), { typing: true, now: 100 });
    h.push(snap("abc"), { typing: true, now: 200 });

    expect(h.undo()?.doc).toEqual(doc(p("")));
    expect(h.canUndo).toBe(false);
  });

  it("starts a new step after a pause, or after a command", () => {
    const h = new History(snap(""));
    h.push(snap("a"), { typing: true, now: 0 });
    h.push(snap("ab"), { typing: true, now: 5000 });
    h.push(snap("abX"), { now: 5100 });
    expect(h.undo()?.doc).toEqual(doc(p("ab")));
    expect(h.undo()?.doc).toEqual(doc(p("a")));
  });

  it("drops the redo branch when something new is done", () => {
    const h = new History(snap(""));
    h.push(snap("a"), { now: 0 });
    h.undo();
    h.push(snap("b"), { now: 10 });
    expect(h.canRedo).toBe(false);
  });

  it("ignores a push that changes nothing", () => {
    const h = new History(snap("a"));
    h.push(snap("a"));
    expect(h.canUndo).toBe(false);
  });
});
