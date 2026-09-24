import "server-only";

import { readAllSections, readSection } from "@/server/content/store";

import { CONTENT_DEFAULTS } from "./defaults";
import { CONTENT_SCHEMAS, type ContentKey, type ContentValue } from "./schema";

/**
 * What the public pages are allowed to ask for.
 *
 * The one rule of this file: **it always answers.** Three things can go wrong
 * between a page and its copy — nobody has saved the section, the database is
 * unreachable, or the row is there but is not the shape this version of the
 * app expects — and all three end in the same place, the value the component
 * shipped with. A marketing page that renders empty strings is worse than one
 * that renders last year's wording, and it is the failure mode a key/value
 * store invites, so it is closed off here rather than defended against in
 * every component.
 *
 * `server-only` keeps the store — and with it the connection string — out of
 * any client bundle: an accidental `"use client"` above an import of this
 * becomes a build error rather than a runtime mystery.
 *
 * The admin desk does *not* read through here. It needs to know whether a
 * section has ever been saved, and it has to tell the admin when the database
 * is down instead of quietly presenting the defaults as if they were the
 * stored row; see `loadSectionsForAdmin` at the foot of this file.
 */

/** Turns whatever the row held into the section's type, or into null. */
function parseSection<K extends ContentKey>(key: K, stored: unknown): ContentValue<K> | null {
  if (stored === null || stored === undefined) return null;

  const parsed = CONTENT_SCHEMAS[key].safeParse(stored);
  if (parsed.success) return parsed.data as ContentValue<K>;

  console.error(
    `[content] stored "${key}" does not match its schema; using the default:`,
    parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
  );
  return null;
}

/**
 * A section, as the page should render it.
 *
 * Never throws and never returns a partial document: a stored row is taken
 * whole or not at all. Merging a valid half of a bad row into the defaults
 * was the alternative, and it is worse — it produces a hero with this year's
 * headline over last year's pictures and no way for anyone to tell.
 */
export async function getContent<K extends ContentKey>(key: K): Promise<ContentValue<K>> {
  let stored: unknown = null;
  try {
    stored = await readSection(key);
  } catch (error) {
    console.error(
      `[content] read of "${key}" failed; using the default:`,
      error instanceof Error ? error.message : error,
    );
    return CONTENT_DEFAULTS[key];
  }

  return parseSection(key, stored) ?? CONTENT_DEFAULTS[key];
}

/* --- admin read (behind requireAdmin) ------------------------------------ */

export type AdminSection<K extends ContentKey> = {
  /** What the form opens with — the stored document, or the default. */
  value: ContentValue<K>;
  /** False when this section has never been saved, or could not be parsed. */
  stored: boolean;
};

export type AdminSections = { [K in ContentKey]: AdminSection<K> };

/**
 * Every section at once, for `/admin/content`.
 *
 * This one throws when the database is down, the way `getAdminArticles` does:
 * the desk has to say "the database is unreachable" rather than render the
 * defaults in the form, because saving that form would then overwrite the
 * real rows with the fallback copy.
 */
export async function loadSectionsForAdmin(): Promise<AdminSections> {
  const rows = await readAllSections();

  const section = <K extends ContentKey>(key: K): AdminSection<K> => {
    const parsed = parseSection(key, rows.get(key) ?? null);
    return { value: parsed ?? CONTENT_DEFAULTS[key], stored: parsed !== null };
  };

  return {
    hero: section("hero"),
    footer: section("footer"),
    "about_stats": section("about_stats"),
  };
}
