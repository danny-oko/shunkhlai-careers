/**
 * Pure presentation helpers for the application card. Nothing here knows the
 * real status ids: the repo does not document them, so tone is decided from
 * the Mongolian words in `statusname` only, and anything unrecognised is
 * neutral.
 */

export type StatusTone = "neutral" | "pending" | "positive" | "negative";

export const DEFAULT_STATUS_LABEL = "Хүлээгдэж буй";
export const NO_SALARY_LABEL = "Цалингийн түвшин сонгоогүй";

/**
 * Formats `yyyy-mm-dd`, `yyyy.mm.dd` or an ISO timestamp as `yyyy.mm.dd`.
 * Works on the leading digits as text; never goes through `Date`, so a
 * date-only string cannot shift a day with the viewer's timezone.
 * Returns null when the value is empty or not a date.
 */
export function formatApplicationDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

/**
 * The date to show: normalised to `yyyy.mm.dd` when recognised, otherwise the
 * raw text as sent (so an unexpected format is never silently dropped).
 * Null only when there is nothing to show.
 */
export function displayApplicationDate(value: unknown): string | null {
  const formatted = formatApplicationDate(value);
  if (formatted) return formatted;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The status text to show; falls back to the page's existing wording. */
export function statusLabel(statusname: unknown): string {
  return typeof statusname === "string" && statusname.trim()
    ? statusname.trim()
    : DEFAULT_STATUS_LABEL;
}

/**
 * Tone for a status pill. Keyword match on `statusname` only. Order matters:
 * negated forms ("...гүй", e.g. "батлагдаагүй", "цуцлагдаагүй") and waiting
 * forms ("...-г хүлээж байна", e.g. "батлагдахыг хүлээж байна") are checked
 * first, so they are never read as a final positive or negative outcome.
 */
export function statusTone(statusname: unknown): StatusTone {
  if (typeof statusname !== "string" || !statusname.trim()) return "neutral";
  const s = statusname.toLowerCase();
  if (/гүй/.test(s)) return "neutral";
  if (/хүлээ/.test(s)) return "pending";
  if (/цуцл|татгалз|няцаа|хасагд/.test(s)) return "negative";
  if (/батлагд|зөвшөөрөгд|тэнцсэн|ажилд авсан/.test(s)) return "positive";
  if (/шалгаж|хянаж|бүртгэгд|илгээгд/.test(s)) return "pending";
  return "neutral";
}

/** Salary band text, or the "not chosen" placeholder. */
export function salaryText(salaryname: unknown): { text: string; chosen: boolean } {
  if (typeof salaryname === "string" && salaryname.trim()) {
    return { text: salaryname.trim(), chosen: true };
  }
  return { text: NO_SALARY_LABEL, chosen: false };
}
