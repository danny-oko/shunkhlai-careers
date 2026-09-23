import type { StuckApplication } from "@/server/applicant/stuck";

/**
 * The desk's wording, as pure functions, so the Mongolian a stuck row is
 * described with is unit-tested rather than read off a screenshot.
 *
 * Every label is chosen from a classified code. The ERP's own message is not
 * available here and is not wanted: it is written in whatever the upstream
 * system felt like returning, and it has been seen carrying the applicant's
 * own регистр and phone back at the caller.
 */

/** Codes an unfamiliar row may hold; anything unlisted gets the fallback. */
const REASONS: Record<string, string> = {
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
};

export const REASON_UNKNOWN = "Тодорхойгүй шалтгаан";

export const reasonLabel = (error: string | undefined): string =>
  error ? (REASONS[error] ?? REASON_UNKNOWN) : REASON_UNKNOWN;

export type DeskTone = "pending" | "negative";

/** The one-line verdict on a row: is anyone still trying, or is it over? */
export function stuckVerdict(row: StuckApplication): { tone: DeskTone; label: string } {
  if (row.terminal) return { tone: "negative", label: "Дахин оролдохоо больсон" };
  return { tone: "pending", label: "Дахин оролдож байна" };
}

/** `2026-09-24 14:05`, or an em dash. Never goes through the viewer's locale. */
export function deskTime(iso: string | undefined): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
