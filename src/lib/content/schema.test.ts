import { describe, expect, it } from "vitest";

import { CONTENT_DEFAULTS } from "./defaults";
import {
  CONTENT_KEYS,
  CONTENT_SCHEMAS,
  aboutStatsSchema,
  contentFieldErrors,
  footerSchema,
  heroSchema,
  isContentKey,
} from "./schema";

/**
 * The section schemas are the boundary this feature stands on: they are what
 * a form posts through on the way in, and what a database row is read through
 * on the way out. A row that is the wrong shape has to be *refused* — not
 * repaired, and certainly not rendered — because the thing on the other side
 * of it is the company's front page.
 *
 * The first test is the load-bearing one: whatever the defaults say, they must
 * still satisfy their own schema, or the fallback is a page that throws.
 */

describe("the defaults are valid documents", () => {
  it.each(CONTENT_KEYS)("%s parses against its own schema", (key) => {
    expect(CONTENT_SCHEMAS[key].safeParse(CONTENT_DEFAULTS[key]).success).toBe(true);
  });

  it("names exactly the three sections the desk edits", () => {
    expect([...CONTENT_KEYS]).toEqual(["hero", "footer", "about_stats"]);
    expect(isContentKey("hero")).toBe(true);
    expect(isContentKey("__proto__")).toBe(false);
    expect(isContentKey("news")).toBe(false);
  });
});

describe("hero", () => {
  const valid = CONTENT_DEFAULTS.hero;

  it("keeps a good document, trimmed", () => {
    const parsed = heroSchema.parse({ ...valid, heading: "  Гарчиг  " });
    expect(parsed.heading).toBe("Гарчиг");
    expect(parsed.slides).toHaveLength(3);
  });

  it("refuses a hero with no pictures at all", () => {
    expect(heroSchema.safeParse({ ...valid, slides: [] }).success).toBe(false);
  });

  it("refuses a blank heading rather than rendering an empty band", () => {
    expect(heroSchema.safeParse({ ...valid, heading: "   " }).success).toBe(false);
  });

  it("refuses a heading longer than the layout survives", () => {
    expect(heroSchema.safeParse({ ...valid, heading: "а".repeat(161) }).success).toBe(false);
  });

  it.each([
    ["http, which would be blocked as mixed content", "http://example.com/a.jpg"],
    ["a protocol-relative host", "//example.com/a.jpg"],
    ["a script URL", "javascript:alert(1)"],
    ["a data URL", "data:image/png;base64,AAAA"],
    ["something that is not an address", "kv-amjilt.jpg"],
  ])("refuses %s as a slide image", (_why, src) => {
    const slides = [{ ...valid.slides[0], src }];
    expect(heroSchema.safeParse({ ...valid, slides }).success).toBe(false);
  });

  it.each(["/brand/kv-amjilt.jpg", "https://res.cloudinary.com/x/image/upload/a.jpg"])(
    "accepts %s",
    (src) => {
      const slides = [{ ...valid.slides[0], src }];
      expect(heroSchema.safeParse({ ...valid, slides }).success).toBe(true);
    },
  );

  it("refuses a slide with no alt text", () => {
    const slides = [{ ...valid.slides[0], alt: "" }];
    expect(heroSchema.safeParse({ ...valid, slides }).success).toBe(false);
  });

  it("refuses a CTA that points at a script", () => {
    const primaryCta = { label: "Дарна уу", href: "javascript:alert(1)" };
    expect(heroSchema.safeParse({ ...valid, primaryCta }).success).toBe(false);
  });
});

describe("footer", () => {
  const valid = CONTENT_DEFAULTS.footer;

  it("keeps the address, the map link and the contact rows", () => {
    const parsed = footerSchema.parse(valid);
    expect(parsed.address).toBe(valid.address);
    expect(parsed.contacts.map((row) => row.label)).toEqual(["Утас", "Facebook", "Instagram"]);
  });

  it.each(["tel:+97696696229", "mailto:hr@shunkhlai.mn", "https://example.com", "/careers"])(
    "accepts %s as a contact link",
    (href) => {
      const contacts = [{ label: "Холбоо", value: "Утга", href }];
      expect(footerSchema.safeParse({ ...valid, contacts }).success).toBe(true);
    },
  );

  it("treats an empty link as no link rather than as a bad one", () => {
    const parsed = footerSchema.parse({
      ...valid,
      addressUrl: "",
      contacts: [{ label: "Хаяг", value: "Улаанбаатар", href: "" }],
    });
    expect(parsed.addressUrl).toBeUndefined();
    expect(parsed.contacts[0].href).toBeUndefined();
  });

  it("refuses a contact link in a scheme the footer does not print", () => {
    const contacts = [{ label: "Х", value: "У", href: "ftp://example.com" }];
    expect(footerSchema.safeParse({ ...valid, contacts }).success).toBe(false);
  });

  it("refuses a contact row with a value but no label", () => {
    const contacts = [{ label: "", value: "9669-6229" }];
    expect(footerSchema.safeParse({ ...valid, contacts }).success).toBe(false);
  });

  it("refuses a blank address", () => {
    expect(footerSchema.safeParse({ ...valid, address: "" }).success).toBe(false);
  });

  it("allows a footer with no contact rows at all", () => {
    expect(footerSchema.safeParse({ ...valid, contacts: [] }).success).toBe(true);
  });
});

describe("about statistics", () => {
  const valid = CONTENT_DEFAULTS.about_stats;

  it("keeps the figures in the order they were given", () => {
    expect(aboutStatsSchema.parse(valid).items.map((item) => item.value)).toEqual([
      "10,029",
      "13,883",
      "4,197",
      "90.7%",
    ]);
  });

  it("keeps a figure as typed, separators and units and all", () => {
    const items = [{ value: "90.7%", label: "үнэлгээ" }];
    expect(aboutStatsSchema.parse({ ...valid, items }).items[0].value).toBe("90.7%");
  });

  it("refuses an empty list — four blank tiles is not a section", () => {
    expect(aboutStatsSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it("refuses a tile with no label", () => {
    const items = [{ value: "10,029", label: "" }];
    expect(aboutStatsSchema.safeParse({ ...valid, items }).success).toBe(false);
  });

  it("refuses more tiles than the grid is drawn for", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      value: String(index),
      label: "тайлбар",
    }));
    expect(aboutStatsSchema.safeParse({ ...valid, items }).success).toBe(false);
  });

  it("refuses a value that is not a string, rather than coercing it", () => {
    const items = [{ value: 10029, label: "хамрагдалт" }];
    expect(aboutStatsSchema.safeParse({ ...valid, items }).success).toBe(false);
  });
});

describe("contentFieldErrors", () => {
  it("keys each message by the input name the form used", () => {
    const result = heroSchema.safeParse({
      ...CONTENT_DEFAULTS.hero,
      heading: "",
      slides: [{ src: "nope", caption: "", alt: "alt" }],
    });
    expect(result.success).toBe(false);

    const errors = contentFieldErrors(result.error!);
    expect(errors.heading).toBeTruthy();
    expect(errors["slides.0.src"]).toBeTruthy();
    expect(errors["slides.0.caption"]).toBeTruthy();
    expect(errors["slides.0.alt"]).toBeUndefined();
  });

  it("keeps the first message per field, not a stack of them", () => {
    const result = aboutStatsSchema.safeParse({ heading: "", items: [] });
    const errors = contentFieldErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual(["heading", "items"]);
  });
});
