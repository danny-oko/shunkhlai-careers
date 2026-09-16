/**
 * Today, in Ulaanbaatar.
 *
 * `new Date().toISOString()` is UTC, and Mongolia is eight hours ahead of it —
 * so from 16:00 local onwards the masthead would print yesterday's date. The
 * `en-CA` locale is used only because it formats as `YYYY-MM-DD`, which is the
 * shape the rest of the newsroom stores dates in.
 */
export function todayInUlaanbaatar(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
