/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import { confirmDiscard, DISCARD_MESSAGE, installUnloadGuard } from "./unsaved-guard";

describe("confirmDiscard", () => {
  it("does not ask when nothing is at risk", () => {
    const ask = vi.fn(() => false);
    expect(confirmDiscard(false, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
  it("follows the answer when dirty", () => {
    expect(confirmDiscard(true, () => false)).toBe(false);
    const ask = vi.fn(() => true);
    expect(confirmDiscard(true, ask)).toBe(true);
    expect(ask).toHaveBeenCalledWith(DISCARD_MESSAGE);
  });
});

describe("installUnloadGuard", () => {
  it("prompts while installed and stops after cleanup", () => {
    const remove = installUnloadGuard(window);
    const first = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    remove();
    const second = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
  });
});
