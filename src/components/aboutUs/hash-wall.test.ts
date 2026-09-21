import { describe, expect, it } from "vitest";

/**
 * The tab a same-document link names, as <CultureSection> works it out.
 *
 * The component reads this off a real click; the rule it applies is here so
 * the cases that used to be wrong - another site with the same path, a tel:
 * link, a hash that names no wall - are pinned down rather than reasoned about.
 */
const KEYS = ["academy", "benefits", "clubs"];

const wallFor = (href: string, here: string) => {
  const url = new URL(href, here);
  const at = new URL(here);
  if (url.origin !== at.origin) return -1;
  if (url.pathname !== at.pathname) return -1;
  return KEYS.findIndex((key) => `#${key}` === url.hash);
};

describe("which wall a link names", () => {
  const here = "https://shunkhlai.mn/about";

  it("finds each wall the footer links to", () => {
    expect(wallFor("/about#academy", here)).toBe(0);
    expect(wallFor("/about#benefits", here)).toBe(1);
    expect(wallFor("/about#clubs", here)).toBe(2);
  });

  it("ignores a hash that names no wall", () => {
    expect(wallFor("/about#life", here)).toBe(-1);
    expect(wallFor("/about", here)).toBe(-1);
  });

  it("ignores another page and another site", () => {
    expect(wallFor("/careers", here)).toBe(-1);
    expect(wallFor("https://example.com/about#clubs", here)).toBe(-1);
  });

  it("ignores a tel: link", () => {
    expect(wallFor("tel:+97670073003", here)).toBe(-1);
  });
});
