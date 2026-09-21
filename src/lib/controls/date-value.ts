/**
 * Pure helpers for the DatePicker. Form state carries dates as `yyyy-mm-dd`
 * strings (or ""), so everything here converts between that and a local-time
 * `Date` without going through UTC — `new Date("2024-01-01")` is UTC midnight
 * and would show the previous day west of Greenwich.
 */

const DATE_SHAPE = /^\s*(\d{4})[-.](\d{2})[-.](\d{2})(?:[T\s].*)?$/u;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Rejects 2024-02-31 and the like rather than letting them shift into March. */
function isRealDate(year: number, month: number, day: number): boolean {
  const probe = new Date(year, month - 1, day);
  // `new Date(99, ...)` maps to 1999; the shape check keeps years four-digit.
  probe.setFullYear(year);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/**
 * `yyyy-mm-dd`, `yyyy.mm.dd`, or either followed by a time — as `yyyy-mm-dd`.
 * Anything else, including impossible dates, is "".
 */
export function normalizeDateValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = DATE_SHAPE.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  return isRealDate(Number(year), Number(month), Number(day)) ? `${year}-${month}-${day}` : "";
}

/** A local `Date` for a form value, or undefined when it is not a real date. */
export function dateFromValue(value: unknown): Date | undefined {
  const iso = normalizeDateValue(value);
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setFullYear(year);
  return date;
}

/** The form value (`yyyy-mm-dd`) for a local `Date`. */
export function valueFromDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** What the trigger shows: `yyyy.mm.dd`, or "" for an empty or unreadable value. */
export function formatDateDisplay(value: unknown): string {
  return normalizeDateValue(value).replaceAll("-", ".");
}

/** Today in the visitor's timezone as a form value. */
export function todayValue(now: Date = new Date()): string {
  return valueFromDate(now);
}

/** True when `value` sits inside the optional inclusive `min`/`max` bounds. */
export function isWithinBounds(value: string, min?: string, max?: string): boolean {
  const iso = normalizeDateValue(value);
  if (!iso) return false;
  // yyyy-mm-dd compares correctly as a string.
  const lo = normalizeDateValue(min);
  const hi = normalizeDateValue(max);
  return (!lo || iso >= lo) && (!hi || iso <= hi);
}

/**
 * The years the month/year dropdowns offer. Birth and education dates go back
 * decades, hire and publish dates run a little ahead, and a saved value outside
 * the default window must still be reachable.
 */
export function yearRange(
  opts: { value?: string; min?: string; max?: string; nowYear?: number } = {},
): { from: number; to: number } {
  const nowYear = opts.nowYear ?? new Date().getFullYear();
  const yearOf = (v?: string) => {
    const iso = normalizeDateValue(v);
    return iso ? Number(iso.slice(0, 4)) : undefined;
  };
  const selected = yearOf(opts.value);
  let from = yearOf(opts.min) ?? nowYear - 100;
  let to = yearOf(opts.max) ?? nowYear + 10;
  if (selected !== undefined) {
    from = Math.min(from, selected);
    to = Math.max(to, selected);
  }
  return { from, to };
}
