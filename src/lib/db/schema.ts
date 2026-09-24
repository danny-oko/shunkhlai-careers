/**
 * Our own persistence layer (PostgreSQL).
 *
 * Clerk owns identity (email / social login). Applicant account data lives in
 * `applicant_account` / `applicant_file`, keyed by the Clerk email.
 *
 * `applicant_link` and `applicant_profile` are from the retired ERP-link flow.
 * They are kept (data retained) but unused, apart from a one-time import of an
 * `applicant_profile` snapshot into a new account. `applicant_link` holds
 * secrets encrypted with the old APP_ENCRYPTION_KEY; nothing decrypts them now.
 *
 * Ported from Cloudflare D1 (SQLite). Table and column names are unchanged, so
 * a row here is recognisably the row that was there. What did change is that
 * the types are now real ones instead of SQLite's four:
 *
 * - the epoch-millisecond integers are `timestamp with time zone`;
 * - `news_article.featured` is a `boolean`, not 0/1;
 * - `news_article.body_json` is `jsonb` — the column name stays, because
 *   renaming it would touch every caller for no gain;
 * - `news_article.published_at` deliberately stays TEXT. It is an editorial
 *   `YYYY-MM-DD`, a lexical sort of it is the chronological one, and
 *   `NewsArticle.publishedAt` is a string its callers already rely on.
 *
 * Where a column is now a `Date` or a `boolean`, the conversion to what the
 * app's public types promise happens at the store boundary (see
 * `src/server/news/store.ts`), not by widening those types.
 *
 * The base64 file tables (`applicant_file`, `news_media`) are being retired.
 * Uploaded bytes now go to the filesystem (`stored_file` plus
 * `src/server/files/store.ts`); these two tables are read-only legacy that the
 * stores still fall back to for files the migration has not moved yet.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** `timestamptz`, read and written as a JS `Date` — the old `timestamp_ms` ints. */
const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** RETIRED: one row per Clerk user ↔ their ERP applicant identity. Unused. */
export const applicantLink = pgTable(
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
    erpTokenExpiresAt: tstz("erp_token_expires_at"),

    status: text("status").notNull().default("pending"), // pending | linked | failed
    lastError: text("last_error"),

    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: tstz("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byClerkUser: uniqueIndex("applicant_link_clerk_user_id_key").on(t.clerkUserId),
  }),
);

/** Our own record of applications pushed to the ERP (idempotency + history). */
export const applicationLog = pgTable(
  "application_log",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    jobId: integer("job_id").notNull(), // ERP recruitmentorderid / entryid
    status: text("status").notNull(), // submitting | submitted | failed
    erpApplicationId: integer("erp_application_id"),
    errorMessage: text("error_message"),
    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    // One application per (user, job): makes the apply flow idempotent.
    byUserJob: uniqueIndex("application_log_user_job_key").on(t.clerkUserId, t.jobId),
  }),
);

/**
 * Mirror of the applicant's personal data from the ERP, kept in OUR DB — this
 * is the "save every personal detail into our own database" piece. Stored as a
 * JSON snapshot (the ERP's `applicantdata[0]`), refreshed on link and on demand.
 *
 * `data_json` stays TEXT rather than becoming `jsonb`: the store parses it
 * defensively (a snapshot from the ERP is not ours to trust as well-formed),
 * and a `jsonb` column would reject a malformed row at write time instead.
 */
export const applicantProfile = pgTable(
  "applicant_profile",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    // The ERP profile record as JSON (name, regno, phone, address, contacts, …).
    dataJson: text("data_json").notNull(),
    syncedAt: tstz("synced_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byClerkUser: uniqueIndex("applicant_profile_clerk_user_id_key").on(t.clerkUserId),
  }),
);

/**
 * The applicant's account — every personal-data section the /account pages
 * edit — as one JSON document per signed-in Clerk email (lowercased). Served by
 * `/api/me/*` on the ERP's own endpoint names. Files live in `applicant_file`.
 */
export const applicantAccount = pgTable(
  "applicant_account",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    clerkUserId: text("clerk_user_id"),
    // profile, education, languages, …, applications, cv/picture metadata, nextEntryId
    dataJson: text("data_json").notNull(),
    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: tstz("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byEmail: uniqueIndex("applicant_account_email_key").on(t.email),
  }),
);

/**
 * The CV and profile photo (base64), split into chunks — see the note at the
 * top: D1 capped a value at 2 MB and a CV may be up to 5 MB (MAX_CV_BYTES),
 * ~6.7 MB as base64. Postgres would take the whole string, but the chunking
 * stays so the port does not rewrite rows it does not have to.
 */
export const applicantFile = pgTable(
  "applicant_file",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    kind: text("kind").notNull(), // cv | picture
    filename: text("filename"),
    chunkIndex: integer("chunk_index").notNull(),
    data: text("data").notNull(),
    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byChunk: uniqueIndex("applicant_file_email_kind_chunk_key").on(t.email, t.kind, t.chunkIndex),
  }),
);

/**
 * The newsroom (`/news`, edited at `/admin/news`). One row per story; the body
 * is a `RichDoc` as `jsonb` (rows written before rich text hold a
 * `NewsBlock[]`, which the store reads through `coerceBody`).
 *
 * `published_at` stays text on purpose: it is an editorial `YYYY-MM-DD` and a
 * lexical sort is the chronological one. `created_at` / `updated_at` are real
 * timestamps now; the store converts them to the ISO strings `NewsArticle`
 * already promises its callers.
 */
export const newsArticle = pgTable(
  "news_article",
  {
    id: text("id").primaryKey(), // art_<10 hex>
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    lede: text("lede").notNull(),
    category: text("category").notNull(), // company | industry | society | people
    author: text("author").notNull(),
    publishedAt: text("published_at").notNull(),
    // med_<12 hex> (bytes in news_media) | https://… (a hosted image, e.g.
    // Cloudinary — never fetched by this app) | seed:<path under public/> | null
    coverKey: text("cover_key"),
    coverAlt: text("cover_alt").notNull().default(""),
    bodyJson: jsonb("body_json").notNull(),
    status: text("status").notNull(), // draft | published
    featured: boolean("featured").notNull().default(false),
    createdAt: tstz("created_at").notNull(),
    updatedAt: tstz("updated_at").notNull(),
  },
  (t) => ({
    bySlug: uniqueIndex("news_article_slug_key").on(t.slug),
    byStatusDate: index("news_article_status_published_idx").on(t.status, t.publishedAt),
  }),
);

/**
 * Uploaded covers (base64), chunked for the same reason as `applicant_file`.
 * Seeded covers are files in `public/` and URL covers live on their own host;
 * neither lands here.
 */
export const newsMedia = pgTable(
  "news_media",
  {
    key: text("key").notNull(), // med_<12 hex>
    chunkIndex: integer("chunk_index").notNull(),
    contentType: text("content_type").notNull(),
    data: text("data").notNull(),
    createdAt: tstz("created_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.key, t.chunkIndex] }),
  }),
);

/**
 * Metadata for a file whose bytes live on the filesystem, not in here.
 *
 * The bytes are content-addressed under `UPLOAD_DIR` — see
 * `src/server/files/store.ts` for the layout and why. This row is what turns
 * an owner ("this applicant's CV", "cover med_ab12…") into a digest, and it
 * carries everything a response needs without opening the file: the content
 * type, the size, and the original filename for a CV download.
 *
 * `(owner_kind, owner_key)` is unique: an owner has at most one current file,
 * and re-uploading replaces the row rather than accumulating versions. That is
 * the same rule the chunked tables enforced with their own unique indexes.
 *
 * `sha256` is deliberately NOT unique. Two applicants who upload the same PDF
 * get one file on disk and two rows here — the row is the reference, and a
 * blob is only removed once no row names it.
 *
 * `applicant_file` and `news_media` stay in place while the move runs: a file
 * that has no row here is still read from its chunks (see the fallbacks in
 * `src/server/applicant/account-store.ts` and `src/server/news/store.ts`), so
 * nothing 404s mid-migration. Dropping those tables is a later change, once
 * `scripts/files/move-to-disk.ts` has been run and verified.
 */
export const storedFile = pgTable(
  "stored_file",
  {
    id: text("id").primaryKey(),
    sha256: text("sha256").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    // applicant_cv | applicant_picture | news_media — see src/server/files/records.ts
    ownerKind: text("owner_kind").notNull(),
    // The applicant's lowercased email, or the `med_<12 hex>` cover key.
    ownerKey: text("owner_key").notNull(),
    // The name the applicant uploaded the CV under; null for the other kinds.
    filename: text("filename"),
    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byOwner: uniqueIndex("stored_file_owner_key").on(t.ownerKind, t.ownerKey),
    // "Does anything still point at these bytes?" — asked on every delete.
    bySha: index("stored_file_sha256_idx").on(t.sha256),
  }),
);

/**
 * Staff who sign in to this app itself (the customer's guide, section 2).
 *
 * This is what `/admin/login` checks: email and password, with the session in
 * `admin_session` below. Rows are made by `scripts/users/create-user.ts`.
 * `is_active = false` is the off switch — it refuses the next sign-in *and*
 * ends the sessions the account already has (see `src/server/admin/store.ts`).
 *
 * `password_hash` holds an argon2id PHC string — never a plaintext password,
 * and never a hash this project invented.
 */
export const appUser = pgTable(
  "app_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("admin"), // admin | editor
    isActive: boolean("is_active").notNull().default(true),
    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byEmail: uniqueIndex("app_user_email_key").on(t.email),
  }),
);

/**
 * A signed-in staff session — the server side of the `shunkhlai.admin` cookie.
 *
 * The cookie carries an opaque random token; this table holds only its SHA-256
 * hash, so a leaked database dump cannot be replayed as a session. Lookup is
 * by hash, which is why the unique index is on `token_hash` and not on `id`.
 *
 * `on delete cascade`: deactivating a user is `is_active = false`, but
 * *deleting* one must not leave their sessions behind as rows that outlive the
 * account they authorise.
 *
 * Expiry is a column rather than a signature, which is the point of moving off
 * the HMAC cookie: a session can be ended by deleting the row (logout, a
 * password change), and nobody holds a token the server cannot revoke.
 */
export const adminSession = pgTable(
  "admin_session",
  {
    id: text("id").primaryKey(), // ses_<16 hex>
    userId: text("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    /** SHA-256 (hex) of the cookie token. The token itself is never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: tstz("expires_at").notNull(),
    createdAt: tstz("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byTokenHash: uniqueIndex("admin_session_token_hash_key").on(t.tokenHash),
    byUser: index("admin_session_user_id_idx").on(t.userId),
  }),
);

/**
 * The marketing copy an admin edits at `/admin/content`, one row per section
 * of a public page (`hero`, `footer`, `about_stats`).
 *
 * A key/value store rather than a column per field: these sections are three
 * unrelated shapes — a list of slides, a list of contact rows, a list of
 * figures — and giving each its own table would mean a migration every time a
 * section gained a field. The shape is instead owned by a zod schema per key
 * (`src/lib/content/schema.ts`), which every read and every write goes
 * through, so a row that does not match is rejected at the boundary and the
 * page falls back to the value it shipped with rather than rendering blanks.
 *
 * `value` is `jsonb` and not TEXT, unlike `applicant_account.data_json`: this
 * document is written by our own validated form, so a malformed one is a bug
 * worth refusing at write time, not a snapshot from someone else's system
 * that the reader has to cope with.
 *
 * `updated_by` references `app_user` and is nullable: `/admin` still signs in
 * with ADMIN_PASSWORD (see docs/postgres.md), so there is no staff row to
 * point at yet. `on delete set null` keeps the edit when the account that
 * made it is removed — the content is the company's, not the editor's.
 */
export const siteContent = pgTable("site_content", {
  key: text("key").primaryKey(), // hero | footer | about_stats
  value: jsonb("value").notNull(),
  updatedAt: tstz("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedBy: text("updated_by").references(() => appUser.id, { onDelete: "set null" }),
});

export type ApplicantLink = typeof applicantLink.$inferSelect;
export type NewApplicantLink = typeof applicantLink.$inferInsert;
export type ApplicationLog = typeof applicationLog.$inferSelect;
export type ApplicantProfileRow = typeof applicantProfile.$inferSelect;
export type ApplicantAccountRow = typeof applicantAccount.$inferSelect;
export type ApplicantFileRow = typeof applicantFile.$inferSelect;
export type NewsArticleRow = typeof newsArticle.$inferSelect;
export type NewsMediaRow = typeof newsMedia.$inferSelect;
export type StoredFileRow = typeof storedFile.$inferSelect;
export type NewStoredFile = typeof storedFile.$inferInsert;
export type AppUserRow = typeof appUser.$inferSelect;
export type AdminSessionRow = typeof adminSession.$inferSelect;
export type SiteContentRow = typeof siteContent.$inferSelect;
