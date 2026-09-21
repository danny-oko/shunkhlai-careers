/**
 * Our own persistence layer (Cloudflare D1 / SQLite).
 *
 * Clerk owns identity (email / social login). Applicant account data lives in
 * `applicant_account` / `applicant_file`, keyed by the Clerk email.
 *
 * `applicant_link` and `applicant_profile` are from the retired ERP-link flow.
 * They are kept (data retained) but unused, apart from a one-time import of an
 * `applicant_profile` snapshot into a new account. `applicant_link` holds
 * secrets encrypted with the old APP_ENCRYPTION_KEY; nothing decrypts them now.
 */
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** RETIRED: one row per Clerk user ↔ their ERP applicant identity. Unused. */
export const applicantLink = sqliteTable(
  "applicant_link",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),

    // Non-secret profile mirror (handy for UI without a round-trip to the ERP).
    firstname: text("firstname"),
    lastname: text("lastname"),
    email: text("email"),

    // Secrets — stored as encrypted strings (AES-256-GCM), never plaintext.
    regnoEnc: text("regno_enc").notNull(),
    phoneEnc: text("phone_enc").notNull(), // ERP password
    erpAccessTokenEnc: text("erp_access_token_enc"),
    erpRefreshTokenEnc: text("erp_refresh_token_enc"),

    // Non-secret ERP session metadata.
    erpAppId: text("erp_app_id"), // the `sub`/`appID` claim from the JWT
    erpTokenExpiresAt: integer("erp_token_expires_at", { mode: "timestamp_ms" }),

    status: text("status").notNull().default("pending"), // pending | linked | failed
    lastError: text("last_error"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byClerkUser: uniqueIndex("applicant_link_clerk_user_id_key").on(t.clerkUserId),
  })
);

/** Our own record of applications pushed to the ERP (idempotency + history). */
export const applicationLog = sqliteTable(
  "application_log",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    jobId: integer("job_id").notNull(), // ERP recruitmentorderid / entryid
    status: text("status").notNull(), // submitting | submitted | failed
    erpApplicationId: integer("erp_application_id"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    // One application per (user, job): makes the apply flow idempotent.
    byUserJob: uniqueIndex("application_log_user_job_key").on(t.clerkUserId, t.jobId),
  })
);

/**
 * Mirror of the applicant's personal data from the ERP, kept in OUR DB — this
 * is the "save every personal detail into our own database" piece. Stored as a
 * JSON snapshot (the ERP's `applicantdata[0]`), refreshed on link and on demand.
 */
export const applicantProfile = sqliteTable(
  "applicant_profile",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    // The ERP profile record as JSON (name, regno, phone, address, contacts, …).
    dataJson: text("data_json").notNull(),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byClerkUser: uniqueIndex("applicant_profile_clerk_user_id_key").on(t.clerkUserId),
  })
);

/**
 * The applicant's account — every personal-data section the /account pages
 * edit — as one JSON document per signed-in Clerk email (lowercased). Served by
 * `/api/me/*` on the ERP's own endpoint names. Files live in `applicant_file`.
 */
export const applicantAccount = sqliteTable(
  "applicant_account",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    clerkUserId: text("clerk_user_id"),
    // profile, education, languages, …, applications, picture metadata, nextEntryId
    dataJson: text("data_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byEmail: uniqueIndex("applicant_account_email_key").on(t.email),
  })
);

/**
 * The profile photo (base64), split into chunks: D1 caps a single value / row
 * at 2 MB.
 */
export const applicantFile = sqliteTable(
  "applicant_file",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    kind: text("kind").notNull(), // picture
    chunkIndex: integer("chunk_index").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byChunk: uniqueIndex("applicant_file_email_kind_chunk_key").on(t.email, t.kind, t.chunkIndex),
  })
);

export type ApplicantLink = typeof applicantLink.$inferSelect;
export type NewApplicantLink = typeof applicantLink.$inferInsert;
export type ApplicationLog = typeof applicationLog.$inferSelect;
export type ApplicantProfileRow = typeof applicantProfile.$inferSelect;
export type ApplicantAccountRow = typeof applicantAccount.$inferSelect;
export type ApplicantFileRow = typeof applicantFile.$inferSelect;
