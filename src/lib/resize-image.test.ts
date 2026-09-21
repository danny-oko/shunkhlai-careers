import { describe, expect, it } from "vitest";

import { fitWithin, MAX_PHOTO_BYTES, MAX_PHOTO_DIMENSION } from "./resize-image";

describe("fitWithin", () => {
  it("leaves images that already fit untouched", () => {
    expect(fitWithin(800, 600, MAX_PHOTO_DIMENSION)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a landscape phone photo by its long side, keeping the ratio", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait photo by its long side", () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never returns a zero-sized side for extreme aspect ratios", () => {
    expect(fitWithin(100000, 10, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe("limits", () => {
  it("matches the server backstop", () => {
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
  });
});
