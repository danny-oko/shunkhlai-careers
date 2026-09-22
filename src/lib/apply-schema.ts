import { z } from "zod";

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

export const salaryLevelKeySchema = z
  .number({ error: "Цалингийн түвшин буруу байна." })
  .int("Цалингийн түвшин буруу байна.")
  .min(1, "Цалингийн түвшин буруу байна.")
  .max(MAX_SALARY_LEVEL_KEY, "Цалингийн түвшин буруу байна.");

export const applicationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Please enter your full name.")
      .max(80, "That name is too long."),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .pipe(z.email("Please enter a valid email address.")),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required.")
      .regex(PHONE_PATTERN, "Enter a valid Mongolian number, e.g. 9911 2233."),
    registerId: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Register ID is required.")
      .regex(
        REGISTER_ID_PATTERN,
        "Use two Cyrillic letters and eight digits, e.g. УБ99112233.",
      ),
    note: z
      .string()
      .trim()
      .max(1000, "Please keep this under 1000 characters.")
      .optional(),
    cv: z.custom<File | null>().nullable(),
  })
  .superRefine((values, ctx) => {
    if (!values.cv) {
      ctx.addIssue({
        code: "custom",
        path: ["cv"],
        message: "Attach your CV to continue.",
      });
      return;
    }

    const fileError = describeCvFileError(values.cv);
    if (fileError) {
      ctx.addIssue({ code: "custom", path: ["cv"], message: fileError });
    }
  });

export type ApplicationValues = z.infer<typeof applicationSchema>;

export const applicationDefaults: ApplicationValues = {
  fullName: "",
  email: "",
  phone: "",
  registerId: "",
  note: "",
  cv: null,
};
