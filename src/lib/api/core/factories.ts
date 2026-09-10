import { apiGet, apiGetList, apiPost } from "./request";

/* -------------------------------------------------------------------------
   Pattern 1 — reference dropdowns
   ------------------------------------------------------------------------
   ~20 endpoints share one signature: `?search=&lfr=false&ids=1`, sometimes
   with a single parent id (countryid, divisionid, skillcompid, type). They
   are public, so they are also the endpoints most worth caching later. */

export type DropdownQuery = {
  search?: string;
  /** "list-for-report" flag in the reference; the UI always sends `false`. */
  lfr?: boolean;
  ids?: string | number;
};

/** A dropdown row after normalisation, ready for a `<select>` or combobox. */
export type DropdownOption = {
  value: string;
  label: string;
  /** The untouched backend row, for the fields the UI occasionally needs. */
  raw: Record<string, unknown>;
};

/**
 * Row shapes are not documented, so this accepts the id/label spellings this
 * kind of backend returns. Narrow it once a real response is available.
 */
function toOption(row: unknown): DropdownOption | null {
  if (typeof row !== "object" || row === null) return null;
  const record = row as Record<string, unknown>;

  const rawValue =
    record.id ?? record.ID ?? record.value ?? record.entryid ?? record.entryID ?? record.code;
  const rawLabel =
    record.name ?? record.Name ?? record.text ?? record.label ?? record.title ?? record.descr;

  if (rawValue === undefined || rawValue === null) return null;

  return {
    value: String(rawValue),
    label: String(rawLabel ?? rawValue),
    raw: record,
  };
}

/**
 * Builds a typed reader for one dropdown endpoint.
 *
 * @param path   Endpoint path, e.g. `/api/applicant/GetCountryDropDown`.
 * @param defaults Extra query defaults for endpoints that take a parent id.
 */
export function createDropdown<TExtra extends Record<string, unknown> = Record<string, never>>(
  path: string,
  defaults?: Partial<TExtra>,
) {
  return async function readDropdown(
    query: DropdownQuery & Partial<TExtra> = {},
  ): Promise<DropdownOption[]> {
    const { search = "", lfr = false, ids = 1, ...extra } = query;
    const rows = await apiGetList<unknown>(
      path,
      { search, lfr, ids, ...defaults, ...extra },
      { skipAuth: true },
    );
    return rows.map(toOption).filter((option): option is DropdownOption => option !== null);
  };
}

/* -------------------------------------------------------------------------
   Pattern 2 — CV section resources
   ------------------------------------------------------------------------
   Fifteen profile sections (education, languages, experience, family, …) all
   expose the same shape: an optional "everything for this tab" bundle, a
   single-entry read by `entryid`, a save where `entryid: 0` means insert, and
   a delete. That is ~45 of the 92 applicant endpoints; describing them as
   data instead of writing them out keeps the module honest and short. */

export type SectionPaths = {
  /** `GetHrApp…Data` — saved entries plus the reference data the tab needs. */
  tabData?: string;
  /** A list endpoint, where the section has one (only references do today). */
  list?: string;
  /** `Get…` — a single entry by `entryid`. */
  get?: string;
  /** `Save…` — insert when `entryid` is 0, update otherwise. */
  save: string;
  /** `Delete…` */
  remove?: string;
};

export type SectionEntry = { entryid?: number; [key: string]: unknown };

export type SectionResource<TEntry extends SectionEntry = SectionEntry> = {
  paths: SectionPaths;
  /** Everything the tab renders, in one call. */
  tabData<T = unknown>(): Promise<T>;
  list(): Promise<TEntry[]>;
  get(entryid: number): Promise<TEntry>;
  /** Several endpoints accept a batch; pass an array to use that. */
  save(payload: TEntry | TEntry[]): Promise<unknown>;
  /**
   * The reference documents no body for the delete endpoints. Passing the
   * whole entry back is the safe reading — it satisfies both a
   * `{ entryid }`-only handler and one that wants the full row.
   */
  remove(entry: TEntry | number): Promise<unknown>;
};

export function createSection<TEntry extends SectionEntry = SectionEntry>(
  paths: SectionPaths,
): SectionResource<TEntry> {
  function missing(operation: string): never {
    throw new Error(`This profile section has no ${operation} endpoint.`);
  }

  return {
    paths,
    tabData<T = unknown>() {
      return paths.tabData ? apiGet<T>(paths.tabData) : missing("tab data");
    },
    list() {
      return paths.list ? apiGetList<TEntry>(paths.list) : missing("list");
    },
    get(entryid: number) {
      return paths.get ? apiGet<TEntry>(paths.get, { entryid }) : missing("get");
    },
    save(payload: TEntry | TEntry[]) {
      return apiPost<unknown>(paths.save, payload);
    },
    remove(entry: TEntry | number) {
      if (!paths.remove) return missing("delete");
      return apiPost<unknown>(
        paths.remove,
        typeof entry === "number" ? { entryid: entry } : entry,
      );
    },
  };
}
