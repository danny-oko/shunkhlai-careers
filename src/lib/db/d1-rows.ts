/**
 * The old D1 (SQLite) rows, as rows for the PostgreSQL tables.
 *
 * Pure: `scripts/db/d1-to-postgres.ts` does the I/O — read a page from D1,
 * hand it here, insert what comes back — and the conversions live here so they
 * can be tested without either database.
 *
 * SQLite has four types and Postgres does not, so this is where:
 *
 * - epoch-millisecond integers (`created_at`, `updated_at`, `synced_at`,
 *   `erp_token_expires_at`) become `timestamptz`;
 * - `news_article.featured` 0/1 becomes a real boolean;
 * - `news_article.body_json` TEXT becomes `jsonb` (parsed; a row that will not
 *   parse is reported and kept as a JSON string rather than dropped);
 * - `news_article.published_at` stays text — it is an editorial `YYYY-MM-DD`
 *   and a lexical sort of it is the chronological one — while the newsroom's
 *   ISO `created_at` / `updated_at` become timestamps.
 *
 * An unreadable timestamp is a warning and `now`, not a thrown migration: one
 * bad value must not stop the copy of the rows around it. A NOT NULL column
 * that is null in D1 does throw, because guessing a value there would invent
 * data.
 */
import type { Table } from "drizzle-orm";

import {
  applicantAccount,
  applicantFile,
  applicantLink,
  applicantProfile,
  applicationLog,
  newsArticle,
  newsMedia,
} from "./schema";

export type D1Row = Record<string, unknown>;

export type D1TableSpec = {
  /** The name in both databases — they were deliberately kept the same. */
  name: string;
  table: Table;
  /** A stable order, so paging cannot skip or repeat a row. */
  orderBy: string;
  /** Rows per read. The base64 chunk tables have to ask for far fewer. */
  pageSize: number;
  convert: (row: D1Row) => Record<string, unknown>;
};

/* --- value conversions --------------------------------------------------- */

export const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export const required = (value: unknown, column: string): string => {
  const out = text(value);
  if (out === null) throw new Error(`${column} is null in D1, but the column is NOT NULL`);
  return out;
};

export const int = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/** An epoch-millisecond integer (SQLite `timestamp_ms`) as a Date. */
export function msToDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = Number(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** The same, for a column that cannot be null: an unreadable value becomes now. */
export function msToDateRequired(value: unknown, column: string): Date {
  const date = msToDate(value);
  if (!date) {
    console.warn(`  ! ${column}: unreadable timestamp ${JSON.stringify(value)}; using now`);
    return new Date();
  }
  return date;
}

/** An ISO string (the newsroom's `created_at` / `updated_at`) as a Date. */
export function isoToDate(value: unknown, column: string): Date {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    console.warn(`  ! ${column}: unreadable date ${JSON.stringify(value)}; using now`);
    return new Date();
  }
  return parsed;
}

/** SQLite's 0/1 (or a stray "true") as a boolean. */
export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return value === "1" || String(value).toLowerCase() === "true";
}

/**
 * `body_json` TEXT as a value for the `jsonb` column.
 *
 * A row that will not parse is kept as the string it was rather than dropped —
 * the story stays in the database, and `coerceBody` in the store falls back to
 * an empty document when it reads it.
 */
export function toJson(value: unknown, id: string): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    console.warn(`  ! ${id}: body_json did not parse; copied as a JSON string`);
    return String(value);
  }
}

/**
 * No foreign keys exist in either schema, but the order is still the FK-safe
 * one — accounts before their files, articles before their media — so a run
 * that is interrupted leaves a consistent prefix rather than orphans.
 */
export const D1_TABLES: D1TableSpec[] = [
  {
    name: "applicant_link",
    table: applicantLink,
    orderBy: "id",
    pageSize: 200,
    convert: (row) => ({
      id: required(row.id, "applicant_link.id"),
      clerkUserId: required(row.clerk_user_id, "applicant_link.clerk_user_id"),
      firstname: text(row.firstname),
      lastname: text(row.lastname),
      email: text(row.email),
      regnoEnc: required(row.regno_enc, "applicant_link.regno_enc"),
      phoneEnc: required(row.phone_enc, "applicant_link.phone_enc"),
      erpAccessTokenEnc: text(row.erp_access_token_enc),
      erpRefreshTokenEnc: text(row.erp_refresh_token_enc),
      erpAppId: text(row.erp_app_id),
      erpTokenExpiresAt: msToDate(row.erp_token_expires_at),
      status: required(row.status, "applicant_link.status"),
      lastError: text(row.last_error),
      createdAt: msToDateRequired(row.created_at, "applicant_link.created_at"),
      updatedAt: msToDateRequired(row.updated_at, "applicant_link.updated_at"),
    }),
  },
  {
    name: "applicant_profile",
    table: applicantProfile,
    orderBy: "id",
    pageSize: 50,
    convert: (row) => ({
      id: required(row.id, "applicant_profile.id"),
      clerkUserId: required(row.clerk_user_id, "applicant_profile.clerk_user_id"),
      dataJson: required(row.data_json, "applicant_profile.data_json"),
      syncedAt: msToDateRequired(row.synced_at, "applicant_profile.synced_at"),
    }),
  },
  {
    name: "applicant_account",
    table: applicantAccount,
    orderBy: "id",
    pageSize: 50,
    convert: (row) => ({
      id: required(row.id, "applicant_account.id"),
      email: required(row.email, "applicant_account.email"),
      clerkUserId: text(row.clerk_user_id),
      dataJson: required(row.data_json, "applicant_account.data_json"),
      createdAt: msToDateRequired(row.created_at, "applicant_account.created_at"),
      updatedAt: msToDateRequired(row.updated_at, "applicant_account.updated_at"),
    }),
  },
  {
    name: "applicant_file",
    table: applicantFile,
    orderBy: "id",
    // Half a megabyte of base64 per row: ask for a few at a time.
    pageSize: 5,
    convert: (row) => ({
      id: required(row.id, "applicant_file.id"),
      email: required(row.email, "applicant_file.email"),
      kind: required(row.kind, "applicant_file.kind"),
      filename: text(row.filename),
      chunkIndex: Number(row.chunk_index ?? 0),
      data: required(row.data, "applicant_file.data"),
      createdAt: msToDateRequired(row.created_at, "applicant_file.created_at"),
    }),
  },
  {
    name: "application_log",
    table: applicationLog,
    orderBy: "id",
    pageSize: 200,
    convert: (row) => ({
      id: required(row.id, "application_log.id"),
      clerkUserId: required(row.clerk_user_id, "application_log.clerk_user_id"),
      jobId: Number(row.job_id),
      status: required(row.status, "application_log.status"),
      erpApplicationId: int(row.erp_application_id),
      errorMessage: text(row.error_message),
      createdAt: msToDateRequired(row.created_at, "application_log.created_at"),
    }),
  },
  {
    name: "news_article",
    table: newsArticle,
    orderBy: "id",
    pageSize: 25,
    convert: (row) => ({
      id: required(row.id, "news_article.id"),
      slug: required(row.slug, "news_article.slug"),
      title: required(row.title, "news_article.title"),
      lede: required(row.lede, "news_article.lede"),
      category: required(row.category, "news_article.category"),
      author: required(row.author, "news_article.author"),
      // Editorial YYYY-MM-DD; text in both databases, on purpose.
      publishedAt: required(row.published_at, "news_article.published_at"),
      coverKey: text(row.cover_key),
      coverAlt: text(row.cover_alt) ?? "",
      bodyJson: toJson(row.body_json, String(row.id)),
      status: required(row.status, "news_article.status"),
      featured: toBoolean(row.featured),
      createdAt: isoToDate(row.created_at, "news_article.created_at"),
      updatedAt: isoToDate(row.updated_at, "news_article.updated_at"),
    }),
  },
  {
    name: "news_media",
    table: newsMedia,
    orderBy: "key, chunk_index",
    pageSize: 5,
    convert: (row) => ({
      key: required(row.key, "news_media.key"),
      chunkIndex: Number(row.chunk_index ?? 0),
      contentType: required(row.content_type, "news_media.content_type"),
      data: required(row.data, "news_media.data"),
      createdAt: isoToDate(row.created_at, "news_media.created_at"),
    }),
  },
];
