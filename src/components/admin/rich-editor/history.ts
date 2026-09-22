import type { RichDoc } from "@/lib/news/shared/rich-text";

import type { Sel } from "./model";

/**
 * The editor's own undo stack.
 *
 * The browser's native one cannot be used: commands, shortcuts and Enter all
 * rewrite the DOM from the document model, and each of those would silently
 * cut the native history in two. So every change is recorded here as a
 * snapshot of the whole document (plus where the caret was), and undo and redo
 * simply put a snapshot back. Documents are small; a snapshot is cheaper than
 * being clever.
 *
 * Typing is coalesced: a burst of keystrokes within `WINDOW_MS` is one step, so
 * Ctrl+Z undoes a phrase rather than a letter.
 */

export type Snapshot = { doc: RichDoc; sel: Sel };

const WINDOW_MS = 900;
const LIMIT = 200;

export class History {
  private stack: Snapshot[];
  private index = 0;
  private lastTypingAt = 0;
  private lastWasTyping = false;

  constructor(initial: Snapshot) {
    this.stack = [initial];
  }

  /** Records the state after a change. `typing` changes within the window merge. */
  push(snapshot: Snapshot, options: { typing?: boolean; now?: number } = {}): void {
    const now = options.now ?? Date.now();
    const typing = Boolean(options.typing);

    if (JSON.stringify(this.stack[this.index].doc) === JSON.stringify(snapshot.doc)) {
      this.stack[this.index] = snapshot;
      return;
    }

    this.stack.length = this.index + 1;
    if (typing && this.lastWasTyping && now - this.lastTypingAt < WINDOW_MS && this.index > 0) {
      this.stack[this.index] = snapshot;
    } else {
      this.stack.push(snapshot);
      this.index += 1;
    }
    this.lastTypingAt = now;
    this.lastWasTyping = typing;

    if (this.stack.length > LIMIT) {
      this.stack.shift();
      this.index -= 1;
    }
  }

  /** Ends a typing burst, so the next keystroke starts a new undo step. */
  breakTyping(): void {
    this.lastWasTyping = false;
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  undo(): Snapshot | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    this.lastWasTyping = false;
    return this.stack[this.index];
  }

  redo(): Snapshot | null {
    if (!this.canRedo) return null;
    this.index += 1;
    this.lastWasTyping = false;
    return this.stack[this.index];
  }
}
