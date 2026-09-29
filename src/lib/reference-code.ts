/**
 * Reference names arrive from the ERP as `/03/ Нэр` — the leading code is an
 * internal number and never belongs on a screen. Position labels carry
 * hyphenated codes too (`/02-007/ …`, `/100-17/ …`).
 *
 * Its own module because both sides of the site need it and only one of them
 * can afford the ERP client: `@/lib/api/core/factories` re-exports it for the
 * browser code that has always imported it from there, and the admin desk's
 * server modules take it from here instead of pulling `core/request` (and the
 * whole ERP transport) in for one regular expression.
 */
export function stripCode(text: string | null | undefined): string {
  return (text ?? "").replace(/^\s*\/\s*\d[\d-]*\s*\/\s*/u, "").trim();
}
