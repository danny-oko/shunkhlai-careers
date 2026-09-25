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

/** Ids at or above this were minted on this site, not by the ERP (`erp-model.ts`). */
const LOCAL_ID_BASE = 1_000_000_000;

/** The `erp` marker `/api/me` keeps on each application row (absent in the mock). */
type RowErp = {
  status?: unknown;
  erpEntryId?: unknown;
  attempts?: unknown;
  error?: unknown;
  /** The sync gave up: refused by the ERP, or out of attempts. */
  terminal?: unknown;
};

/**
 * Pushes before the sync stops retrying — `MAX_ATTEMPTS` in
 * `server/applicant/erp-retry.ts`, repeated rather than imported because this
 * module is bundled for the browser and that one reaches for `node:crypto`.
 * It is only a fallback: a row the current server wrote carries `terminal`.
 */
export const PUSH_ATTEMPTS = 5;

const rowErp = (row: { erp?: unknown }): RowErp | null =>
  row.erp && typeof row.erp === "object" ? (row.erp as RowErp) : null;

/**
 * The request number the ERP (and HR) know it by: the id the push learnt, or
 * the row's own id when it came from the ERP. Null while only this site has it.
 */
export function erpRequestNumber(row: { entryid?: unknown; erp?: unknown }): number | null {
  const known = Number(rowErp(row)?.erpEntryId);
  if (known > 0) return known;
  const own = Number(row.entryid);
  return own > 0 && own < LOCAL_ID_BASE ? own : null;
}

/** `hint`: what the applicant can do about it, when anything. */
export type SyncState = { tone: StatusTone; label: string; hint?: string };

/** Terminal codes: the ERP read the payload and refused it. See `erp-retry.ts`. */
const REJECTED = new Set(["erp_apply_rejected"]);

/**
 * Where the copy to the ERP stands, in plain words. Null when there is no ERP
 * (mock mode: `skipped`, or no marker at all).
 *
 * Three honest things and no fourth. The application itself is safe in every
 * one of them — it was committed here before the ERP was called at all — so
 * none of these words may read as "your application is gone":
 *
 * - **хадгалагдсан / илгээгдэж байна** — ours, on its way. A `pending` row, and
 *   also a `failed` one that is still being retried: from the applicant's side
 *   those are the same situation, and "алдаа" on a row the server will retry
 *   in forty seconds is a lie that generates a support call.
 * - **илгээгдсэн** — the ERP has it.
 * - **анхаарал шаардлагатай** — nobody is retrying any more. This is the only
 *   state that asks the applicant to do something, and it is only ever shown
 *   when the row really is terminal.
 */
export function syncState(row: { erp?: unknown }): SyncState | null {
  const erp = rowErp(row);
  switch (erp?.status) {
    case "pending":
      return { tone: "pending", label: "Хадгалагдсан — ERP-д илгээгдэж байна" };
    case "failed": {
      // Waiting on something, not failing: it goes by itself once that is done.
      if (erp.error === "profile_incomplete") {
        return { tone: "pending", label: "Хувийн мэдээллээ бөглөсний дараа илгээгдэнэ" };
      }
      if (erp.error === "erp_withdraw_pending") {
        return { tone: "pending", label: "Өмнөх хүсэлт цуцлагдсаны дараа илгээгдэнэ" };
      }
      const rejected = REJECTED.has(String(erp.error));
      const done = erp.terminal === true || rejected || Number(erp.attempts) >= PUSH_ATTEMPTS;
      if (done) {
        return {
          tone: "negative",
          label: "Анхаарал шаардлагатай",
          hint: rejected
            ? "ERP систем хүсэлтийг хүлээж авсангүй. Хүний нөөцтэй холбогдоно уу."
            : "Хүсэлт хадгалагдсан ч ERP-д хүрсэнгүй. Хүний нөөцтэй холбогдоно уу.",
        };
      }
      // Still being retried: the row is safe and nothing is asked of them.
      return { tone: "pending", label: "Хадгалагдсан — дахин илгээхийг оролдож байна" };
    }
    // "sent" is the normal case: the status pill already says enough.
    default:
      return null;
  }
}

/** The posting's page, when the row knows which posting it is for. */
export function postingHref(row: { recruitmentorderid?: unknown }): string | null {
  const id = Number(row.recruitmentorderid);
  return Number.isInteger(id) && id > 0 ? `/careers/${id}` : null;
}
