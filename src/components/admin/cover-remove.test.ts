import { describe, expect, it } from "vitest";

import { KEEP, afterTick, afterUrlEdit, isRemoving } from "./cover-remove";

describe("cover removal", () => {
  it("emptying a pre-filled URL removes, and pasting one back undoes it", () => {
    const emptied = afterUrlEdit(KEEP, "", true);
    expect(isRemoving(emptied)).toBe(true);

    const pasted = afterUrlEdit(emptied, "https://res.cloudinary.com/x/a.jpg", true);
    expect(isRemoving(pasted)).toBe(false);
  });

  it("an empty field means nothing when the stored cover is not a URL", () => {
    expect(isRemoving(afterUrlEdit(KEEP, "  ", false))).toBe(false);
  });

  it("an explicit tick survives edits to the URL field", () => {
    const ticked = afterTick(KEEP, true);
    expect(isRemoving(afterUrlEdit(ticked, "https://res.cloudinary.com/x/a.jpg", true))).toBe(
      true,
    );
    expect(isRemoving(afterUrlEdit(ticked, "", true))).toBe(true);
  });

  it("unticking clears both reasons, so the box can always be unticked", () => {
    const both = afterTick(afterUrlEdit(KEEP, "", true), true);
    expect(isRemoving(afterTick(both, false))).toBe(false);
  });
});
