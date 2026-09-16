import { z } from "zod";

import { NEWS_CATEGORIES, type NewsCategory } from "./types";

/**
 * Validation for the newsroom editor.
 *
 * Separate from `src/lib/apply-schema.ts` on purpose: that one guards real
 * applicant PII and its limits are a security decision. This one guards a
 * `<textarea>` an employee types into, so the limits here exist to keep a
 * front page from breaking — a 400-character headline has no layout that
 * survives it — rather than to keep anything out.
 *
 * Every message is Mongolian, because the person reading it is the editor.
 */

export const ARTICLE_LIMITS = {
  title: 140,
  lede: 320,
  author: 80,
  coverAlt: 160,
  body: 24_000,
  /** One photograph off a phone, give or take. Beyond this it is a mistake. */
  coverBytes: 5 * 1024 * 1024,
} as const;

export const COVER_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const CATEGORY_VALUES = NEWS_CATEGORIES.map((category) => category.value) as [
  NewsCategory,
  ...NewsCategory[],
];

/**
 * A real calendar day, not just four-two-two digits.
 *
 * `new Date("2026-02-30")` rolls forward to March rather than failing, so the
 * only reliable check is to build the date and confirm it kept the day it was
 * given.
 */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Огноо ББББ-СС-ӨӨ хэлбэртэй байна.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Тийм огноо байхгүй.");

/** `<input type="checkbox">` sends "on" when ticked and nothing at all when not. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined(), z.null()])
  .transform((value) => value === "on" || value === "true");

export const articleFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Гарчиг шаардлагатай.")
    .max(ARTICLE_LIMITS.title, `Гарчиг ${ARTICLE_LIMITS.title} тэмдэгтээс урт байж болохгүй.`),
  lede: z
    .string()
    .trim()
    .min(1, "Тэргүүн үг шаардлагатай.")
    .max(ARTICLE_LIMITS.lede, `Тэргүүн үг ${ARTICLE_LIMITS.lede} тэмдэгтээс урт байж болохгүй.`),
  category: z.enum(CATEGORY_VALUES, { message: "Бүлгийг сонгоно уу." }),
  author: z
    .string()
    .trim()
    .min(1, "Нийтлэлчийн нэр шаардлагатай.")
    .max(ARTICLE_LIMITS.author, `Нэр ${ARTICLE_LIMITS.author} тэмдэгтээс урт байж болохгүй.`),
  publishedAt: isoDate,
  coverAlt: z
    .string()
    .trim()
    .max(
      ARTICLE_LIMITS.coverAlt,
      `Зургийн тайлбар ${ARTICLE_LIMITS.coverAlt} тэмдэгтээс урт байж болохгүй.`,
    ),
  body: z
    .string()
    .trim()
    .min(1, "Мэдээний бичвэр шаардлагатай.")
    .max(ARTICLE_LIMITS.body, "Бичвэр хэт урт байна."),
  status: z.enum(["draft", "published"], { message: "Төлвийг сонгоно уу." }),
  featured: checkbox,
  removeCover: checkbox,
});

export type ArticleFormValues = z.infer<typeof articleFormSchema>;

/**
 * One message per field, keyed by the form's own input names.
 *
 * The editor renders each error under its own field, so a flat array of issues
 * is the wrong shape; the first issue per field is the one worth showing —
 * "required" and "too long" cannot both be true, and a stack of messages under
 * one input is noise.
 */
export function articleFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }

  return errors;
}

/** What the editor may upload, phrased for the person who just tried not to. */
export function coverFileError(file: File): string | null {
  if (!COVER_TYPES.includes(file.type as (typeof COVER_TYPES)[number])) {
    return "Зураг JPEG, PNG, WebP эсвэл AVIF хэлбэртэй байна.";
  }
  if (file.size > ARTICLE_LIMITS.coverBytes) {
    return "Зураг 5MB-аас хөнгөн байна.";
  }
  return null;
}
