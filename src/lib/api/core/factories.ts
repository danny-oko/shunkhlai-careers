import { stripCode } from "@/lib/reference-code";

import { apiGet, apiGetList, apiPost } from "./request";

/* -------------------------------------------------------------------------
   Pattern 1 — reference dropdowns
   ------------------------------------------------------------------------
   Around twenty endpoints share one shape: `?search=&lfr=false&ids=`, some
   with a parent id, all answering with `{ key, text }` rows (a few add
   `row_index`, and the positions list adds `posgroupid` / `depid`). */

export type DropdownQuery = {
  /** Filter by name. */
  search?: string;
  /** `true` returns only the five most recent rows. */
  lfr?: boolean;
  /** Ask for specific ids back, so a saved value can be resolved to its label. */
  ids?: string | number | Array<string | number>;
};

export type DropdownRow = {
  key: number | string;
  text: string;
  row_index?: number;
  [extra: string]: unknown;
};

/** A dropdown row after normalisation, ready for a `<select>` or combobox. */
export type DropdownOption = {
  value: string;
  label: string;
  /** The untouched row — `getPositionsDropdown` carries posgroupid/depid here. */
  raw: DropdownRow;
};

/**
 * Reference names arrive as `/03/ Name` — drop the leading code for display.
 * Lives in `@/lib/reference-code` so the admin desk's server modules can use
 * it without importing this file's ERP transport; re-exported here because
 * every caller has always taken it from the barrel above this module.
 */
export { stripCode };

export function toOption(row: DropdownRow): DropdownOption {
  return { value: String(row.key), label: stripCode(row.text), raw: row };
}

/** True when `ids` names at least one row (a bare `ids=` is a 400). */
function hasIds(ids: DropdownQuery["ids"]): boolean {
  return Array.isArray(ids) ? ids.length > 0 : String(ids ?? "") !== "";
}

/**
 * The query string for one dropdown call.
 *
 * Standard dropdowns send `search` and `lfr`; the search-only endpoints send
 * `search` alone. `ids` is left out when empty: the server rejects a bare
 * `ids=` with a 400 ("The value '' is invalid."). Array ids stay
 * `?ids=1&ids=2` via axios's `indexes: null`.
 */
function dropdownParams(query: DropdownQuery, standard: boolean): Record<string, unknown> {
  const { search = "", ...rest } = query;
  return standard ? standardParams(search, rest) : { search, ...withoutShared(rest) };
}

/** `lfr` and `ids` mean nothing to a search-only endpoint; a parent id does. */
function withoutShared(rest: Omit<DropdownQuery, "search">): Record<string, unknown> {
  const { lfr: _lfr, ids: _ids, ...extra } = rest;
  return extra;
}

function standardParams(search: string, rest: Omit<DropdownQuery, "search">): Record<string, unknown> {
  const { lfr = false, ids, ...extra } = rest;
  return { search, lfr, ...(hasIds(ids) ? { ids } : {}), ...extra };
}

/**
 * Builds a reader for one dropdown endpoint.
 *
 * @param path      e.g. `/api/applicant/GetCountryDropDown`
 * @param options   `standard: false` for the three that take `search` only.
 */
// `Record<never, never>` rather than `Record<string, never>`: the latter is an
// index signature saying every key is `undefined`, so `DropdownQuery &
// Partial<TExtra>` refused a `{ search }` a caller had in hand for one of the
// endpoints that take no parent id.
export function createDropdown<TExtra extends Record<string, unknown> = Record<never, never>>(
  path: string,
  options: { standard?: boolean } = {},
) {
  const standard = options.standard ?? true;

  return async function readDropdown(
    query: DropdownQuery & Partial<TExtra> = {},
  ): Promise<DropdownOption[]> {
    const rows = await apiGetList<DropdownRow>(path, dropdownParams(query, standard), {
      skipAuth: true,
    });
    return rows.filter((row) => row && row.key !== undefined).map(toOption);
  };
}

/* -------------------------------------------------------------------------
   Pattern 2 — CV section resources
   ------------------------------------------------------------------------
   The CV sections all work the same way: one bundle call returns several
   lists at once (education, languages, qualifications and computer skills
   share `GetHrAppEducationData`), a `Get…?entryid=` reads one row for
   editing, `Save…` inserts when `entryid` is 0, and `Delete…` takes its id in
   the *query string* — with the parameter spelled differently per endpoint,
   which is why `removeParam` is explicit. */

export type SectionEntry = { entryid?: number; [key: string]: unknown };

export type SectionConfig = {
  /** `GetHrApp…Data` — returns this section's list alongside its siblings. */
  bundle: string;
  /** Key inside the bundle holding this section's rows. */
  listKey: string;
  /** `Get…` — one row by `entryid`, for editing. */
  get?: string;
  /** `Save…` — `entryid: 0` inserts. */
  save: string;
  /** `Delete…` */
  remove?: string;
  /** Query parameter name for the delete call — the casing genuinely varies. */
  removeParam?: "entryid" | "ENTRYID" | "entryID";
  /** True when the save endpoint takes an array of rows rather than one. */
  batch?: boolean;
};

export type SectionResource<TEntry extends SectionEntry = SectionEntry> = {
  config: SectionConfig;
  /** Every row in this section. */
  list(): Promise<TEntry[]>;
  /** The whole bundle, when a screen renders several sections at once. */
  bundle<T = Record<string, unknown>>(): Promise<T>;
  get(entryid: number): Promise<TEntry | null>;
  save(entry: TEntry | TEntry[]): Promise<unknown>;
  remove(entryid: number): Promise<unknown>;
};

/** A `Get…` answer is one row or a one-row array; either way, the row or null. */
function firstRow<T>(row: T | T[] | null): T | null {
  return (Array.isArray(row) ? row[0] : row) ?? null;
}

export function createSection<TEntry extends SectionEntry = SectionEntry>(
  config: SectionConfig,
): SectionResource<TEntry> {
  return {
    config,

    async bundle<T = Record<string, unknown>>() {
      return apiGet<T>(config.bundle);
    },

    async list() {
      const data = await apiGet<Record<string, unknown>>(config.bundle);
      const rows = data?.[config.listKey];
      return Array.isArray(rows) ? (rows as TEntry[]) : [];
    },

    async get(entryid: number) {
      if (!config.get) throw new Error(`${config.listKey}: no single-row endpoint.`);
      // The collection warns that entryid 0 comes back empty.
      if (!entryid) return null;
      return firstRow(await apiGet<TEntry | TEntry[] | null>(config.get, { entryid }));
    },

    save(entry: TEntry | TEntry[]) {
      const payload = config.batch && !Array.isArray(entry) ? [entry] : entry;
      return apiPost<unknown>(config.save, payload);
    },

    remove(entryid: number) {
      if (!config.remove) throw new Error(`${config.listKey}: no delete endpoint.`);
      return apiPost<unknown>(config.remove, undefined, {
        params: { [config.removeParam ?? "entryid"]: entryid },
      });
    },
  };
}
