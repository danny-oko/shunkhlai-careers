import { z } from "zod";

/**
 * The shape of every editable section of the marketing pages.
 *
 * One zod schema per `site_content` key, used in both directions: the admin
 * form parses what was typed before it writes, and the public read parses what
 * the database returned before it renders. The second half is the one that
 * matters — a row written by an older version of this file, or by hand in
 * `psql`, is a shape the page was never written for, and parsing it here turns
 * "the hero renders `undefined`" into "the hero renders what it shipped with".
 *
 * The fields are the ones the components already had, not a redesign of them:
 * `heroSchema` is `hero-stage.tsx` / `hero-overlay.tsx`, `footerSchema` is the
 * contact column and the address line of `site-footer.tsx`, and
 * `aboutStatsSchema` is the `academyFigures` tiles of `<FiguresPanel>`. See
 * `./defaults.ts` for the values those files held.
 *
 * Every message is Mongolian: the only person who ever sees one is the admin
 * filling the form in.
 *
 * Limits exist to keep a layout standing — a 400-character headline has no
 * hero that survives it — not to keep anything out; this form is behind
 * `requireAdmin()`.
 */

export const CONTENT_LIMITS = {
  heading: 160,
  caption: 80,
  alt: 220,
  label: 60,
  href: 500,
  imageSrc: 500,
  address: 200,
  contactValue: 120,
  statValue: 24,
  statLabel: 120,
  /** Three slides today; the band is drawn for a handful, not a gallery. */
  slides: 8,
  contacts: 10,
  stats: 8,
} as const;

/** What the admin sees when the section could not be written. */
export const CONTENT_DB_ERROR =
  "Контентын сантай холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.";

/* --- shared field types --------------------------------------------------- */

const text = (max: number, required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .max(max, `${max} тэмдэгтээс урт байж болохгүй.`);

/**
 * A picture the site may render: a file shipped in `public/` or an `https:`
 * address (a Cloudinary upload, in practice).
 *
 * `http:` is refused rather than upgraded. The page is served over TLS, so an
 * `http:` image is a mixed-content block — a picture that silently does not
 * appear — and guessing that the same host answers on 443 is not this form's
 * guess to make.
 */
const IMAGE_SRC_ERROR = "Зураг '/'-ээр эхэлсэн зам эсвэл https:// хаяг байна.";

const imageSrc = z
  .string()
  .trim()
  .min(1, "Зураг шаардлагатай.")
  .max(CONTENT_LIMITS.imageSrc, `${CONTENT_LIMITS.imageSrc} тэмдэгтээс урт байж болохгүй.`)
  .refine((value) => {
    if (value.startsWith("/")) return !value.startsWith("//"); // `//host` is off-site
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, IMAGE_SRC_ERROR);

/**
 * Somewhere this site can send a reader: an in-app path, or an address in one
 * of the three schemes the footer already links out with.
 *
 * `javascript:` and `data:` are the reason this is a list and not "anything
 * with a colon in it" — these strings land in an `href` attribute.
 */
const LINK_ERROR = "Холбоос '/'-ээр эхэлсэн зам эсвэл https:, mailto:, tel: хаяг байна.";

const LINK_SCHEMES = ["https:", "mailto:", "tel:"];

const link = z
  .string()
  .trim()
  .max(CONTENT_LIMITS.href, `${CONTENT_LIMITS.href} тэмдэгтээс урт байж болохгүй.`)
  .refine((value) => {
    if (value.startsWith("/")) return !value.startsWith("//");
    try {
      return LINK_SCHEMES.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, LINK_ERROR);

/** A link that may simply be absent — a contact row printed without one. */
const optionalLink = z
  .union([link, z.literal("")])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

/* --- hero (home) ---------------------------------------------------------- */

/**
 * The opening band of `/`.
 *
 * `slides` is a list because the hero has always been three campaign posters
 * on a timer, and the caption under the headline is the showing slide's own —
 * so the "subheading" is per-slide here, exactly as it is on screen.
 *
 * `primaryCta.label` is only the words. The open-role count printed in front
 * of it comes from the recruitment API on every render and is not content
 * anyone should be able to type a different number into.
 */
export const heroSchema = z.object({
  heading: text(CONTENT_LIMITS.heading, "Гарчиг шаардлагатай."),
  slides: z
    .array(
      z.object({
        src: imageSrc,
        caption: text(CONTENT_LIMITS.caption, "Тайлбар шаардлагатай."),
        alt: text(CONTENT_LIMITS.alt, "Зургийн тайлбар шаардлагатай."),
      }),
    )
    .min(1, "Дор хаяж нэг зураг шаардлагатай.")
    .max(CONTENT_LIMITS.slides, `${CONTENT_LIMITS.slides} зургаас олон байж болохгүй.`),
  primaryCta: z.object({
    label: text(CONTENT_LIMITS.label, "Товчны бичиг шаардлагатай."),
    href: link,
  }),
  secondaryCta: z.object({
    label: text(CONTENT_LIMITS.label, "Товчны бичиг шаардлагатай."),
    href: link,
  }),
});

/* --- footer --------------------------------------------------------------- */

/**
 * The foot of every public page: where the company is, and how to reach it.
 *
 * `contacts` is one list rather than named phone / email / social fields
 * because that is how the column is printed — "label: value", in the order
 * given — and because which of them the company wants printed changes more
 * often than the layout does. Today it is a phone and two social pages; an
 * email is a row added in the form, not a schema change.
 *
 * `addressUrl` is deliberately its own field and not derived from `address`:
 * the two are not the same thing. See the note in `site-footer.tsx` — the
 * printed address searches to a building two kilometres from the office, so
 * the link has to be the company's own map listing.
 */
export const footerSchema = z.object({
  address: text(CONTENT_LIMITS.address, "Хаяг шаардлагатай."),
  addressUrl: optionalLink,
  contacts: z
    .array(
      z.object({
        label: text(CONTENT_LIMITS.label, "Нэр шаардлагатай."),
        value: text(CONTENT_LIMITS.contactValue, "Утга шаардлагатай."),
        href: optionalLink,
      }),
    )
    .max(CONTENT_LIMITS.contacts, `${CONTENT_LIMITS.contacts} мөрөөс олон байж болохгүй.`),
});

/* --- about statistics ----------------------------------------------------- */

/**
 * The four figures that close `/about` — the Academy's year in numbers.
 *
 * `value` is a string, not a number, because these are printed as typed:
 * "10,029" carries its thousands separator and "90.7%" its unit, and both are
 * set in `tabular-nums` so the tiles line up whatever is in them.
 *
 * `heading` is part of the section because it carries the year ("... · 2026"),
 * which is exactly the thing that goes stale when the figures are refreshed.
 */
export const aboutStatsSchema = z.object({
  heading: text(CONTENT_LIMITS.heading, "Гарчиг шаардлагатай."),
  items: z
    .array(
      z.object({
        value: text(CONTENT_LIMITS.statValue, "Тоо шаардлагатай."),
        label: text(CONTENT_LIMITS.statLabel, "Тайлбар шаардлагатай."),
      }),
    )
    .min(1, "Дор хаяж нэг үзүүлэлт шаардлагатай.")
    .max(CONTENT_LIMITS.stats, `${CONTENT_LIMITS.stats} үзүүлэлтээс олон байж болохгүй.`),
});

/* --- the registry --------------------------------------------------------- */

export const CONTENT_SCHEMAS = {
  hero: heroSchema,
  footer: footerSchema,
  "about_stats": aboutStatsSchema,
} as const;

export const CONTENT_KEYS = ["hero", "footer", "about_stats"] as const;

export type ContentKey = (typeof CONTENT_KEYS)[number];

export type ContentValue<K extends ContentKey> = z.output<(typeof CONTENT_SCHEMAS)[K]>;

export type HeroContent = z.output<typeof heroSchema>;
export type FooterContent = z.output<typeof footerSchema>;
export type AboutStatsContent = z.output<typeof aboutStatsSchema>;

export function isContentKey(value: string): value is ContentKey {
  return (CONTENT_KEYS as readonly string[]).includes(value);
}

/**
 * One message per field, keyed by the path the form's input names use —
 * `slides.0.caption`, `contacts.2.value`. The newsroom's
 * `articleFieldErrors` does the same for a flat form; the paths here are
 * nested because the sections are lists.
 */
export function contentFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.join(".") : "form";
    errors[field] ??= issue.message;
  }
  return errors;
}
