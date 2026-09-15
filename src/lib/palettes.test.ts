import { describe, expect, it } from "vitest";

import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_IDS,
  getPalette,
  isPaletteId,
  nextPaletteId,
} from "./palettes";

/**
 * The header's palette button is a single control with no menu: the only way
 * to reach a scheme is to keep pressing until it comes round. So the two
 * things worth pinning down are that pressing really does reach every scheme
 * and come back, and that a stored id from an older build can never put the
 * site into a scheme that has no CSS behind it.
 */
describe("nextPaletteId", () => {
  it("reaches every scheme and returns to the start", () => {
    const walked = [DEFAULT_PALETTE];
    for (let press = 1; press < PALETTE_IDS.length; press++) {
      walked.push(nextPaletteId(walked[press - 1]));
    }

    expect(new Set(walked).size).toBe(PALETTE_IDS.length);
    expect(nextPaletteId(walked[walked.length - 1])).toBe(DEFAULT_PALETTE);
  });
});

describe("isPaletteId", () => {
  it("accepts every id that has a scheme", () => {
    for (const id of PALETTE_IDS) expect(isPaletteId(id)).toBe(true);
  });

  it("rejects anything else, so a stale stored value is ignored", () => {
    // What localStorage can hand back after a rename, or never having been set.
    for (const value of ["", "Cloud", "sunset", null, undefined, 1, {}]) {
      expect(isPaletteId(value)).toBe(false);
    }
  });
});

describe("PALETTES", () => {
  it("lists exactly the ids, in the order the button walks them", () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual([...PALETTE_IDS]);
  });

  it("starts on the brandbook palette", () => {
    expect(PALETTES[0].id).toBe(DEFAULT_PALETTE);
  });

  it("names every scheme, so the button always has a label", () => {
    for (const id of PALETTE_IDS) {
      const palette = getPalette(id);
      expect(palette.id).toBe(id);
      expect(palette.label).not.toBe("");
      expect(palette.source).not.toBe("");
    }
  });
});
