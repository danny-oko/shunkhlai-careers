/**
 * The newsroom's own shape.
 *
 * Nothing here talks to the recruitment backend — the newsroom is this site's
 * own content, stored and served by this app. `src/lib/jobs/*` is the model to
 * read it against: types the UI speaks, with the formatting helpers next to the
 * data they format, so a component never reaches for `Intl` and guesses.
 */

import { type RichDoc, docText, excerpt, readingMinutes as readingMinutesOf } from "./shared/rich-text";

export type NewsCategory = "company" | "industry" | "society" | "people";

/**
 * The body format before rich text. No longer stored: it survives only so that
 * old JSON on disk and the seed can be read (see `legacy.ts`).
 */
export type NewsBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "quote"; text: string; attribution: string | null }
  | { kind: "list"; items: string[] };

export type NewsStatus = "draft" | "published";

/**
 * The two states, in the order the admin offers them. Labels and hints live
 * here so the desk's filter, the row badge and the editor say the same thing
 * about a story, and so the hint says what a reader can see.
 */
export const NEWS_STATUSES: ReadonlyArray<{
  value: NewsStatus;
  label: string;
  hint: string;
}> = [
  { value: "published", label: "Нийтлэгдсэн", hint: "Сайтад харагдаж байна" },
  { value: "draft", label: "Ноорог", hint: "Сайтад харагдахгүй" },
];

export function statusLabel(value: NewsStatus): string {
  return NEWS_STATUSES.find((status) => status.value === value)?.label ?? "";
}

export function statusHint(value: NewsStatus): string {
  return NEWS_STATUSES.find((status) => status.value === value)?.hint ?? "";
}

export type NewsArticle = {
  /** `art_` plus 10 hex. */
  id: string;
  /** URL-safe, transliterated from the Mongolian title. */
  slug: string;
  title: string;
  /** Standfirst: one to three sentences under the headline. */
  lede: string;
  category: NewsCategory;
  author: string;
  /** `YYYY-MM-DD` — the editorial date, not a timestamp. */
  publishedAt: string;
  /** Served at `/api/news/media/<coverKey>`; null while a draft has no image. */
  coverKey: string | null;
  coverAlt: string;
  body: RichDoc;
  status: NewsStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * The four desks, in the order they are offered everywhere — filter chips,
 * the editor's select, the archive. One array so those three can never drift
 * apart.
 */
export const NEWS_CATEGORIES: ReadonlyArray<{
  value: NewsCategory;
  label: string;
  labelEn: string;
}> = [
  { value: "company", label: "Компани", labelEn: "Company" },
  { value: "industry", label: "Салбар", labelEn: "Industry" },
  { value: "society", label: "Нийгэм", labelEn: "Society" },
  { value: "people", label: "Хүний нөөц", labelEn: "People" },
];

export function categoryLabel(value: NewsCategory): string {
  return NEWS_CATEGORIES.find((category) => category.value === value)?.label ?? "";
}

export function isNewsCategory(value: unknown): value is NewsCategory {
  return NEWS_CATEGORIES.some((category) => category.value === value);
}

/**
 * Mongolian ordinal month suffix.
 *
 * Vowel harmony picks between дүгээр and дугаар: the front-vowel months (1, 4,
 * 9, 11) take дүгээр, the rest дугаар. It follows the month's *spoken* name, so
 * there is no rule to derive it from the number — the list is the rule.
 */
const MONTH_SUFFIX = [
  "дүгээр", // 1  нэг
  "дугаар", // 2  хоёр
  "дугаар", // 3  гурав
  "дүгээр", // 4  дөрөв
  "дугаар", // 5  тав
  "дугаар", // 6  зургаа
  "дугаар", // 7  долоо
  "дугаар", // 8  найм
  "дүгээр", // 9  ес
  "дугаар", // 10 арав
  "дүгээр", // 11 арван нэг
  "дугаар", // 12 арван хоёр
] as const;

/** Splits `YYYY-MM-DD` without going through `Date`, which shifts by timezone. */
function parts(isoDate: string): { year: string; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year: match[1], month, day };
}

/** "2026 оны 9 дүгээр сарын 15". Returns "" for anything unparseable. */
export function formatNewsDate(isoDate: string): string {
  const date = parts(isoDate);
  if (!date) return "";
  return `${date.year} оны ${date.month} ${MONTH_SUFFIX[date.month - 1]} сарын ${date.day}`;
}

/** "2026.09.15" — for datelines with no room for the long form. */
export function formatNewsDateShort(isoDate: string): string {
  const date = parts(isoDate);
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.year}.${pad(date.month)}.${pad(date.day)}`;
}

/**
 * 180 words a minute — the slow end of the usual 180-260 range, because
 * Mongolian Cyrillic sets longer words than the English the figure comes from.
 * Never zero: "0 минут" reads as broken rather than short.
 */
export function readingMinutes(body: RichDoc): number {
  return readingMinutesOf(docText(body));
}

/**
 * Plain-text opening of an article, for cards and meta descriptions.
 *
 * Cuts on a word boundary so a Cyrillic word is never sliced mid-syllable, and
 * only appends the ellipsis when something was actually dropped.
 */
export function bodyExcerpt(body: RichDoc, max = 180): string {
  return excerpt(docText(body), max);
}

/**
 * Where a cover is served from.
 *
 * Covers do not live in `public/` — an uploaded one arrives at runtime — so
 * they go through a route handler keyed by the store's media id. Seeded
 * articles reuse the brand photographs already in `public/brand/` under a
 * `seed:` key, and those keys carry a colon and a slash: both have to be
 * percent-encoded or the path reads as extra segments and misses the route.
 */
export function coverUrl(coverKey: string | null): string | null {
  if (!coverKey) return null;
  return `/api/news/media/${encodeURIComponent(coverKey)}`;
}
