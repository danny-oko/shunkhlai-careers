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

export function describeCvFileError(file: File): string | null {
  const hasAcceptedType = ACCEPTED_CV_TYPES.includes(file.type);
  const hasAcceptedExtension = ACCEPTED_CV_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );

  if (!hasAcceptedType && !hasAcceptedExtension) {
    return "Upload a PDF, DOC or DOCX file.";
  }
  if (file.size > MAX_CV_BYTES) {
    return "That file is larger than 5 MB.";
  }
  return null;
}

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
    needsCvHelp: z.boolean(),
    cv: z.custom<File | null>().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.needsCvHelp) return;

    if (!values.cv) {
      ctx.addIssue({
        code: "custom",
        path: ["cv"],
        message: "Attach your CV, or ask us to help you create one.",
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
  needsCvHelp: false,
  cv: null,
};
