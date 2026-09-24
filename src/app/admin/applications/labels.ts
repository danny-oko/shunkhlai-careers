import type { DeskApplication, DeskPush } from "@/server/applicant/application-desk";

/**
 * The desk's wording, as pure functions, so the Mongolian a row is described
 * with is unit-tested rather than read off a screenshot.
 *
 * Carried over from the `stuck-labels.ts` the old stuck-only desk had, because
 * the vocabulary was right and only the screen around it was wrong. Every
 * label is still chosen from a **classified code**: the ERP's own message is
 * not available here and is not wanted — it is written in whatever the upstream
 * system felt like returning, and it has been seen carrying the applicant's own
 * регистр and phone back at the caller.
 */

/* --- the push state ------------------------------------------------------ */

/**
 * The five states an application can be in on this desk, which are the four
 * `PUSH_STATUSES` with `failed` split in two.
 *
 * That split is the whole operational question the screen answers: a `failed`
 * row the sync will try again in four minutes needs nobody, and a `failed` row
 * nothing is retrying needs a person today. One word for both was what made the
 * old desk unreadable.
 */
export const DESK_STATUSES = [
  "sent",
  "pending",
  "retrying",
  "attention",
  "skipped",
  "unknown",
] as const;

export type DeskStatus = (typeof DESK_STATUSES)[number];

export type DeskTone = "positive" | "pending" | "negative" | "neutral";

/** The row's state, from the marker the sync left on it. Pure. */
export function deskStatus(push: DeskPush): DeskStatus {
  switch (push.status) {
    case "sent":
      return "sent";
    case "pending":
      return "pending";
    case "skipped":
      return "skipped";
    case "failed":
      return push.terminal ? "attention" : "retrying";
    default:
      return "unknown";
  }
}

const STATUS_LABELS: Readonly<Record<DeskStatus, string>> = {
  sent: "ERP-д илгээгдсэн",
  pending: "ERP-д илгээгдэж байна",
  retrying: "Дахин оролдож байна",
  attention: "Анхаарал шаардлагатай",
  skipped: "ERP тохируулаагүй",
  unknown: "Төлөв тодорхойгүй",
};

const STATUS_TONES: Readonly<Record<DeskStatus, DeskTone>> = {
  sent: "positive",
  pending: "pending",
  retrying: "pending",
  attention: "negative",
  skipped: "neutral",
  unknown: "neutral",
};

export const statusLabel = (status: DeskStatus): string => STATUS_LABELS[status];
export const statusTone = (status: DeskStatus): DeskTone => STATUS_TONES[status];

/** The filter pills' own wording: shorter, because they sit in a row of six. */
const FILTER_LABELS: Readonly<Record<DeskStatus, string>> = {
  sent: "Илгээгдсэн",
  pending: "Илгээгдэж байна",
  retrying: "Дахин оролдож байна",
  attention: "Анхаарал",
  skipped: "ERP-гүй",
  unknown: "Тодорхойгүй",
};

export const filterLabel = (status: DeskStatus): string => FILTER_LABELS[status];

/* --- why it failed ------------------------------------------------------- */

/** Codes a row may hold; anything unlisted gets the fallback below. */
const REASONS: Readonly<Record<string, string>> = {
  "erp_unreachable": "ERP-д холбогдож чадсангүй",
  "erp_unavailable": "ERP хариу өгсөнгүй (сервер завгүй)",
  "erp_apply_failed": "Илгээх үед алдаа гарлаа",
  "erp_apply_rejected": "ERP хүсэлтийг хүлээж авсангүй",
  "erp_login_failed": "ERP-д нэвтэрч чадсангүй",
  "erp_link_mismatch": "Регистр ба утасны дугаар таарахгүй байна",
  "erp_password_refused": "ERP нууц үг солихыг зөвшөөрсөнгүй",
  "erp_password_failed": "Нууц үг солих үед алдаа гарлаа",
  "erp_register_failed": "ERP-д бүртгүүлж чадсангүй",
  "erp_profile_failed": "Хувийн мэдээллийг илгээж чадсангүй",
  "erp_cv_failed": "CV-г илгээж чадсангүй",
  "profile_incomplete": "Хувийн мэдээлэл дутуу — бөглөгдөхийг хүлээж байна",
  "erp_withdraw_pending": "Өмнөх цуцлалт дуусахыг хүлээж байна",
  "erp_link_refused": "ERP өмнө нь эдгээр мэдээллийг татгалзсан",
  "erp_register_busy": "Бүртгэл үүсгэх ажил явагдаж байна",
  "erp_not_configured": "ERP хаяг тохируулаагүй байна",
};

export const REASON_UNKNOWN = "Тодорхойгүй шалтгаан";

export const reasonLabel = (error: string | undefined): string =>
  error ? (REASONS[error] ?? REASON_UNKNOWN) : REASON_UNKNOWN;

/* --- the source strip ---------------------------------------------------- */

/**
 * The sentence the page opens with, in both of its states.
 *
 * It is two facts, not one, and both are always true: the rows are this site's
 * mirror (the ERP has no endpoint that lists applications across applicants —
 * see `application-desk.ts`), and the ERP either answered this render or did
 * not. Collapsing them into a single "source: ERP" would be the lie the whole
 * banner exists to avoid.
 */
export const SOURCE_TITLE = "Эх сурвалж: энэ сайтын толь";

export const SOURCE_SCOPE =
  "ERP-д бүх нэр дэвшигчийн өргөдлийг нэг дор унших хаяг байхгүй тул энд зөвхөн " +
  "энэ сайтаар дамжин ирсэн өргөдөл харагдана. ERP-д шууд ирсэн өргөдөл энэ " +
  "жагсаалтад ороогүй болно.";

export function erpReachLabel(
  erp: { reachable: true; postings: number } | { reachable: false; reason: string },
): string {
  if (erp.reachable) {
    return `ERP хариу өглөө — ${erp.postings} зар нээлттэй байна.`;
  }
  if (erp.reason === "erp_not_configured") {
    return "ERP хаяг тохируулаагүй байна — зарын төлөв шалгагдсангүй.";
  }
  return `${reasonLabel(erp.reason)} — зарын төлөв шалгагдсангүй, жагсаалт тольноос уншигдлаа.`;
}

/* --- dates --------------------------------------------------------------- */

/**
 * `2026.09.24 14:05` from an ISO stamp, `2026.09.24` from a date-only string,
 * and an em dash from anything else.
 *
 * A date-only value never goes through `Date`, so it cannot shift a day with
 * the server's timezone — the same rule `application-format.ts` follows on the
 * applicant's side.
 */
export function deskTime(value: string | undefined): string {
  if (!value) return "—";

  const dateOnly = /^\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*$/u.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return `${y}.${m.padStart(2, "0")}.${d.padStart(2, "0")}`;
  }

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value.trim() || "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The date column: the day only, because the list sorts by it and no more. */
export function deskDate(value: string | undefined): string {
  return deskTime(value).slice(0, 10);
}

/* --- rows ---------------------------------------------------------------- */

export const NAME_UNKNOWN = "Нэр бүртгэгдээгүй";
export const JOB_UNKNOWN = "Ажлын байр тодорхойгүй";

export const rowName = (row: Pick<DeskApplication, "name">): string => row.name || NAME_UNKNOWN;

export const rowJob = (row: Pick<DeskApplication, "jobTitle" | "jobId">): string =>
  row.jobTitle || (row.jobId > 0 ? `Ажлын байр #${row.jobId}` : JOB_UNKNOWN);
