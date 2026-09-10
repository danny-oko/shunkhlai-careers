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

export function toOption(row: DropdownRow): DropdownOption {
  return { value: String(row.key), label: (row.text ?? "").trim(), raw: row };
}

/**
 * Builds a reader for one dropdown endpoint.
 *
 * @param path      e.g. `/api/applicant/GetCountryDropDown`
 * @param options   `standard: false` for the three that take `search` only.
 */
export function createDropdown<TExtra extends Record<string, unknown> = Record<string, never>>(
  path: string,
  options: { standard?: boolean } = {},
) {
  const standard = options.standard ?? true;

  return async function readDropdown(
    query: DropdownQuery & Partial<TExtra> = {},
  ): Promise<DropdownOption[]> {
    const { search = "", lfr = false, ids = "", ...extra } = query;
    const params: Record<string, unknown> = standard
      ? { search, lfr, ids, ...extra }
      : { search, ...extra };

    const rows = await apiGetList<DropdownRow>(path, params, { skipAuth: true });
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
      const row = await apiGet<TEntry | TEntry[] | null>(config.get, { entryid });
      if (Array.isArray(row)) return row[0] ?? null;
      return row ?? null;
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
