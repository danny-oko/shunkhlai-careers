/**
 * The apply form's plain rules: patterns, CV limits and the salary-key bound.
 *
 * Kept apart from `apply-schema.ts` because that file imports zod, and these
 * are needed by code that ships in every page's JavaScript — the applicant
 * identity checks reach the root layout's session provider. Anything here must
 * stay free of zod (and of anything else heavy) so it costs the client nothing.
 * `apply-schema.ts` re-exports all of it, so existing imports keep working.
 */

/** Mongolian register number: two Cyrillic letters followed by eight digits. */
export const REGISTER_ID_PATTERN = /^[А-ЯӨҮ]{2}\d{8}$/;

/** Mongolian mobile: eight digits, optionally prefixed with +976. */
export const PHONE_PATTERN = /^(\+?976[\s-]?)?\d{4}[\s-]?\d{4}$/;

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ACCEPTED_CV_EXTENSIONS = [".pdf", ".doc", ".docx"];

const MAX_CV_MB = MAX_CV_BYTES / (1024 * 1024);

/** The limits as the CV pickers show them. */
export const CV_LIMITS_TEXT = `PDF, DOC эсвэл DOCX · ${MAX_CV_MB} MB хүртэл`;

/** Why this file cannot be the CV (shown to the applicant), or null. */
export function describeCvFileError(file: File): string | null {
  const hasAcceptedType = ACCEPTED_CV_TYPES.includes(file.type);
  const hasAcceptedExtension = ACCEPTED_CV_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );

  if (!hasAcceptedType && !hasAcceptedExtension) {
    return "PDF, DOC эсвэл DOCX файл оруулна уу.";
  }
  if (file.size > MAX_CV_BYTES) {
    return `Файл ${MAX_CV_MB} MB-аас том байна. Жижиг файл сонгоно уу.`;
  }
  return null;
}

/**
 * The apply endpoint's salary field is a salary-LEVEL key — the `key` of a
 * `getDropDownData.salarylevel` band — not an amount in tögrög. The backend
 * column is NUMBER(2), so anything of three digits (e.g. 2000000) fails with
 * ORA-01438 and creates no row. Bound it here so an amount can never be sent.
 */
export const MAX_SALARY_LEVEL_KEY = 99;
