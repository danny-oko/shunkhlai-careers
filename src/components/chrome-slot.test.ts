import { describe, expect, it } from "vitest";

import { hasOwnChrome } from "./chrome-slot";

describe("hasOwnChrome", () => {
  it("hides the site chrome on the admin desk and its login", () => {
    expect(hasOwnChrome("/admin")).toBe(true);
    expect(hasOwnChrome("/admin/login")).toBe(true);
    expect(hasOwnChrome("/admin/news/art_123")).toBe(true);
  });

  it("keeps it everywhere else", () => {
    expect(hasOwnChrome("/")).toBe(false);
    expect(hasOwnChrome("/news")).toBe(false);
    expect(hasOwnChrome("/administration")).toBe(false);
    expect(hasOwnChrome(null)).toBe(false);
  });
});
