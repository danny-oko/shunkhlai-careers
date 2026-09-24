import { z } from "zod";

import { MAX_SALARY_LEVEL_KEY, PHONE_PATTERN, REGISTER_ID_PATTERN, describeCvFileError } from "./apply-rules";

export * from "./apply-rules";

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
