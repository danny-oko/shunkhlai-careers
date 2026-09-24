import { eq } from "drizzle-orm";

import { getDb, siteContent, type SiteContentRow } from "@/lib/db";
import type { ContentKey } from "@/lib/content/schema";

/**
 * Storage for the editable marketing copy: one `site_content` row per section,
 * through the same Drizzle client as the newsroom and the applicant account.
 *
 * Deliberately untyped at this boundary — `readSection` answers `unknown`.
 * The row is a JSON document and this layer has no idea which shape belongs to
 * which key; parsing it is `src/lib/content/service.ts`'s job, and giving the
 * caller a typed value here would be this file claiming a guarantee it cannot
 * make about a row a migration or a `psql` session could have written.
 *
 * Nothing caches. The database is shared by every host — an edit on localhost
 * is an edit production reads — so every read is a query, exactly as the
 * newsroom store does it.
 */

/** The stored document, or null when nobody has saved this section yet. */
export async function readSection(key: ContentKey): Promise<unknown | null> {
  const rows = await getDb()
    .select({ value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.key, key))
    .limit(1);

  return rows[0]?.value ?? null;
}

/** Every stored section in one query, for a desk that renders all of them. */
export async function readAllSections(): Promise<Map<string, unknown>> {
  const rows: Array<Pick<SiteContentRow, "key" | "value">> = await getDb()
    .select({ key: siteContent.key, value: siteContent.value })
    .from(siteContent);

  return new Map(rows.map((row) => [row.key, row.value]));
}

/**
 * Writes a section, replacing whatever was there.
 *
 * An upsert rather than an insert-or-update pair: two admins saving the same
 * section at the same moment would otherwise race between the SELECT and the
 * INSERT and one of them would get a primary-key violation instead of a save.
 * There is no version column and no conflict UI — last write wins, which for
 * three sections edited by a handful of staff is the honest trade.
 *
 * `updatedBy` is a nullable `app_user.id`; `/admin` still signs in with
 * ADMIN_PASSWORD, so today it is always null. It is written through rather
 * than dropped so that wiring the login onto `app_user` needs no change here.
 */
export async function writeSection(
  key: ContentKey,
  value: unknown,
  updatedBy: string | null = null,
): Promise<void> {
  const now = new Date();

  await getDb()
    .insert(siteContent)
    .values({ key, value, updatedAt: now, updatedBy })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value, updatedAt: now, updatedBy },
    });
}
