import { createHash } from "node:crypto";

import type { MaritalOption } from "@/lib/api/profile";
import { isIdentityComplete, normalizePhone, normalizeRegno } from "@/lib/applicant-identity";
import type { ApplicantDoc, DocErp, HandlerDeps, PendingDelete, Row } from "./handlers";

/**
 * The pure half of the two-way ERP sync: which D1 list maps to which ERP
 * endpoints, how an ERP pull is merged into a document without losing local
 * changes, and how a local change is recorded for the next flush. No I/O here;
 * `erp-pull.ts` / `erp-flush.ts` fetch, `erp-sync.ts` loads and saves.
 *
 * Row markers: section rows carry `erp: "synced"` (came from the ERP) or
 * `erp: "pending"` (created/edited here, not pushed yet). Application rows keep
 * their `ApplicationErp` object (`erp-push.ts`). Ids at or above
 * `LOCAL_ID_BASE` were minted here; anything lower is the ERP's own entry id.
 */

export const LOCAL_ID_BASE = 1_000_000_000;

export const isLocalId = (entryid: unknown) => Number(entryid) >= LOCAL_ID_BASE;

export type SectionKey =
  | "education"
  | "languages"
  | "qualifications"
  | "skills"
  | "experience"
  | "projects"
  | "internships"
  | "family"
  | "relatives"
  | "interests";

export type SectionConfig = {
  key: SectionKey;
  /** GET endpoint that returns this list (a bundle, or the list itself). */
  source: string;
  /** Key inside the bundle; absent when `source` returns the list directly. */
  listKey?: string;
  save?: string;
  /** Takes an array of rows. */
  batch?: boolean;
  remove?: string;
  /** Query parameter the ERP delete takes, exactly as the Postman collection spells it. */
  removeParam?: string;
};

const EDU = "GetHrAppEducationData";
const EXP = "GetHrAppExperienceData";
const FAM = "GetHrAppFamilyData";

/** qualifications / projects / internships / relatives are read-only: no save or delete endpoint exists. */
export const SECTIONS: SectionConfig[] = [
  { key: "education", source: EDU, listKey: "hrappedulist", save: "SaveHrAppEducation", remove: "DeleteHrAppEducation", removeParam: "ENTRYID" },
  { key: "languages", source: EDU, listKey: "hrapplanglist", save: "SaveAppForLanguage", remove: "DeleteAppForLanguage", removeParam: "entryid" },
  { key: "qualifications", source: EDU, listKey: "hrappquallist" },
  { key: "skills", source: EDU, listKey: "hrappcomplist", save: "SaveAppSkillComp", batch: true, remove: "DeleteAppSkillComp", removeParam: "entryid" },
  { key: "experience", source: EXP, listKey: "hrappexplist", save: "SaveAppExperience", remove: "DeleteAppExperience", removeParam: "entryid" },
  { key: "projects", source: EXP, listKey: "hrappprojectlist" },
  { key: "internships", source: EXP, listKey: "hrappinternlist" },
  { key: "family", source: FAM, listKey: "hrappfamilylist", save: "SaveAppFamily", batch: true, remove: "DeleteAppFamily", removeParam: "entryid" },
  { key: "relatives", source: FAM, listKey: "hrapprelativelist" },
  { key: "interests", source: "getInterestedJobsList", save: "SaveInterestedJobItem", remove: "deleteInterestedJob", removeParam: "entryid" },
];

export const SOURCES = [...new Set(SECTIONS.map((s) => s.source))];

/** ERP delete endpoints → their query parameter (applications included). */
export const DELETE_PARAMS: Record<string, string> = {
  ...Object.fromEntries(
    SECTIONS.filter((s) => s.remove).map((s) => [s.remove!, s.removeParam!]),
  ),
  DeleteOrderApp: "entryID",
};

export const sectionBySave = (endpoint: string) => SECTIONS.find((s) => s.save === endpoint);
export const sectionByRemove = (endpoint: string) => SECTIONS.find((s) => s.remove === endpoint);

/* --- rows --------------------------------------------------------------- */

const AUDIT = /^(appid|created\w*|updated\w*|ipaddress|macaddress|tstamp)$/i;

/** Drops the ERP's audit columns; the UI never reads them. */
export function stripAudit(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !AUDIT.test(key)));
}

/** The list for one section out of a fetched source (null = not usable). */
export function sectionList(config: SectionConfig, source: unknown): Row[] | null {
  const list = config.listKey
    ? source && typeof source === "object" && !Array.isArray(source)
      ? (source as Row)[config.listKey]
      : undefined
    : source;
  return Array.isArray(list) ? (list as Row[]) : null;
}

/** Ids of ERP rows queued for deletion through `endpoint`. */
export function deletedIds(deletes: PendingDelete[] | undefined, endpoint: string | undefined): Set<number> {
  return new Set(
    (deletes ?? []).filter((d) => d.endpoint === endpoint).map((d) => Number(d.entryid)),
  );
}

export const snapshotOf = (row: Row) => JSON.stringify(row);

/**
 * ERP list + the local rows not pushed yet. A pending edit of an ERP row
 * replaces that row; a pending new row is appended; rows queued for deletion
 * stay gone. `pushed` holds snapshots of pending rows the ERP now has — they are
 * represented by the ERP list and dropped.
 */
export function mergeSection(
  config: SectionConfig,
  current: Row[],
  erpRows: Row[],
  deletes: PendingDelete[] | undefined,
  pushed: Set<string> = new Set(),
): Row[] {
  const gone = deletedIds(deletes, config.remove);
  const result = erpRows
    .filter((row) => !gone.has(Number(row.entryid)))
    .map((row) => ({ ...stripAudit(row), erp: "synced" }) as Row);
  for (const row of current) {
    if (row.erp !== "pending" || pushed.has(snapshotOf(row))) continue;
    const index = result.findIndex((r) => Number(r.entryid) === Number(row.entryid));
    if (index >= 0) result[index] = row;
    else result.push(row);
  }
  return result;
}

/* --- section save bodies ------------------------------------------------ */

/**
 * Labels our handler adds for display (the ERP derives its own from the ids);
 * the browser never sent them, so neither do we.
 */
export const DISPLAY_ONLY = new Set([
  "universityname",
  "professionname",
  "educationlevelname",
  "forlanguagename",
  "listeninglevelname",
  "speakinglevelname",
  "readinglevelname",
  "writinglevelname",
  "skillcompname",
  "levelname",
  "jobname",
  "businesstypename",
  "headjobname",
  "relativename",
  "countryname",
  "divisionname",
  "districtname",
  "posgroupname",
  "positionname",
]);

/** The body for a section save: our marker and labels dropped, the ERP id (or 0). */
export function saveBody(row: Row): Row {
  const body = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "erp" && !DISPLAY_ONLY.has(key)),
  );
  return { ...body, entryid: isLocalId(row.entryid) ? 0 : Number(row.entryid) };
}

/* --- rows the ERP holds under ids not known here ------------------------- */

/** An unadopted row: its local id and the body the ERP accepted for it (no `entryid`). */
export type Unadopted = { id: number; body: Row };

/** What `markPushed` notes for a row saved without learning its ERP id. */
export function unadoptedOf(row: Row): Unadopted {
  const { entryid: _id, ...body } = saveBody(row);
  return { id: Number(row.entryid), body };
}

const DATE = /^\s*(\d{4})[-.](\d{2})[-.](\d{2})(?:[T\s].*)?$/u;
const NUMERIC = /^\s*-?\d+(?:\.\d+)?\s*$/u;

/**
 * A value as the ERP may hand it back: numbers and numeric text alike, dates
 * as YYYY-MM-DD, text trimmed, and empty, null and 0 all "" (an omitted
 * numeric column comes back as 0 or null).
 */
function normal(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  const date = DATE.exec(text);
  if (date) return `${date[1]}-${date[2]}-${date[3]}`;
  const out = NUMERIC.test(text) ? String(Number(text)) : text;
  return out === "0" ? "" : out;
}

/**
 * Body fields a section's ERP row may not read back as sent, so content
 * matching skips them: the ERP derives its own flag from `todate`
 * (`isgraduated`, `isworking` — seen replaced by `graduated` / `working`), and
 * `businesstypenametext` is a column the ERP team was only asked to add
 * (Careers-API-2-fixes, item 2) — until it is live the row comes back without it.
 */
export const ADOPTION_IGNORE: Partial<Record<SectionKey, readonly string[]>> = {
  education: ["isgraduated"],
  experience: ["isworking", "businesstypenametext"],
};

/**
 * Every field the body sent reads back the same on the ERP row (extra ERP
 * columns ignored, and the section's `ADOPTION_IGNORE` fields too).
 */
function sameContent(body: Row, erpRow: Row, ignore: readonly string[] = []): boolean {
  return Object.keys(body).every(
    (key) => ignore.includes(key) || normal(body[key]) === normal(erpRow[key]),
  );
}

/** One pass over a section's unadopted rows against an ERP list (see `planAdoption`). */
export type Adoption = {
  /** Local id → ERP id. */
  renamed: Map<number, number>;
  /** Unmatched and unedited: the ERP's own row stands in, the local copy goes. */
  dropped: number[];
  /** Every unadopted id this pass settled (all of them). */
  resolved: number[];
};

/**
 * Finds the ERP rows the section's unadopted rows became, by content: the
 * body each was saved with against the ERP rows no row here carries the id of
 * (nor a queued delete). Only a unique 1:1 match is adopted. The rest:
 * unedited → dropped (the ERP list stands in for them); edited → left with
 * its local id, so it goes as a new row next — at worst one duplicate, never a
 * lost edit or a stuck section. Every unadopted id is settled by one pass.
 */
export function planAdoption(doc: ApplicantDoc, config: SectionConfig, erpRows: Row[]): Adoption | null {
  const entries = doc.erp?.unadopted?.[config.key] ?? [];
  if (entries.length === 0) return null;
  const rows = doc[config.key];
  const known = new Set(rows.filter((row) => !isLocalId(row.entryid)).map((row) => Number(row.entryid)));
  const gone = deletedIds(doc.erp?.pendingDeletes, config.remove);
  const unknown = erpRows.filter((row) => {
    const id = Number(row.entryid);
    return id > 0 && !known.has(id) && !gone.has(id);
  });

  const present = entries.filter((entry) => rows.some((row) => Number(row.entryid) === entry.id));
  const ignore = ADOPTION_IGNORE[config.key];
  const candidates = new Map(
    present.map((entry) => [
      entry.id,
      unknown.filter((row) => sameContent(entry.body, row, ignore)).map((row) => Number(row.entryid)),
    ]),
  );
  const claims = new Map<number, number>();
  for (const ids of candidates.values()) for (const id of ids) claims.set(id, (claims.get(id) ?? 0) + 1);

  const adoption: Adoption = { renamed: new Map(), dropped: [], resolved: entries.map((entry) => entry.id) };
  for (const entry of present) {
    const ids = candidates.get(entry.id)!;
    if (ids.length === 1 && claims.get(ids[0]) === 1) adoption.renamed.set(entry.id, ids[0]);
    else if (rows.find((row) => Number(row.entryid) === entry.id)?.erp !== "pending") adoption.dropped.push(entry.id);
  }
  return adoption;
}

/**
 * `rows` with an adoption applied (a new array; renamed rows are copies):
 * ids adopted, unedited unmatched copies gone. Leaves `unadopted` alone.
 */
export function adoptRows(rows: Row[], adoption: Adoption): Row[] {
  const dropped = new Set(adoption.dropped);
  return rows
    .filter((row) => !(dropped.has(Number(row.entryid)) && row.erp !== "pending"))
    .map((row) => {
      const erpId = adoption.renamed.get(Number(row.entryid));
      return erpId ? { ...row, entryid: erpId } : row;
    });
}

/** Applies an adoption to the document and settles its unadopted ids. */
export function applyAdoption(doc: ApplicantDoc, key: SectionKey, adoption: Adoption): void {
  doc[key] = adoptRows(doc[key], adoption);
  const erp = doc.erp;
  if (!erp?.unadopted?.[key]) return;
  const resolved = new Set(adoption.resolved);
  const left = erp.unadopted[key]!.filter((entry) => !resolved.has(entry.id));
  if (left.length) erp.unadopted[key] = left;
  else delete erp.unadopted[key];
  if (Object.keys(erp.unadopted).length === 0) delete erp.unadopted;
}

/* --- display labels ----------------------------------------------------- */

type Label = HandlerDeps["label"];

/**
 * A label a section row carries next to its id, for the list to show: `name`
 * is `id` looked up in `dropdown`, under each of `parents` in turn (the first
 * list that has the id wins).
 */
type LabelSpec = { name: string; id: string; dropdown: string; parents?: (row: Row) => Row[] };

/**
 * The labels per section. The ERP's own lists document ids only (Postman
 * `hrappedulist`: `universityid`, `professionid`, `educationlevelid`, …), so a
 * row pulled from there is labelled here the same way a save through
 * `/api/me` is.
 */
export const SECTION_LABELS: Partial<Record<SectionKey, LabelSpec[]>> = {
  education: [
    {
      name: "universityname",
      id: "universityid",
      dropdown: "GetUniversityDropDown",
      // `countryid=0` is the collection's "every country"; it is also where a
      // school sits that the country's own list leaves out (live 2026-09-22:
      // 1841 rows for 0, 1762 for Монгол).
      parents: (row) =>
        Number(row.countryid) > 0 ? [{ countryid: row.countryid }, { countryid: 0 }] : [{ countryid: 0 }],
    },
    { name: "professionname", id: "professionid", dropdown: "GetProfessionDropDown" },
    { name: "educationlevelname", id: "educationlevelid", dropdown: "get_educationlevel_dropdown" },
  ],
  // Postman `hrapplanglist` is ids only too. All four skills read one level list.
  languages: [
    { name: "forlanguagename", id: "forlanguageid", dropdown: "GetForLanguageDropDown" },
    ...(["listening", "speaking", "reading", "writing"] as const).map((skill) => ({
      name: `${skill}levelname`,
      id: `${skill}levelid`,
      dropdown: "GetForLanguageLevelDropDown",
    })),
  ],
  // Postman `hrappcomplist` is ids only as well. A program the list lacks is
  // `skillcompid: 0` + `compnametext` (no list label); its level is still
  // looked up — live (2026-09-22) the level list is the same under every
  // `skillcompid`, 0 included.
  skills: [
    { name: "skillcompname", id: "skillcompid", dropdown: "GetSkillCompDropDown" },
    {
      name: "levelname",
      id: "levelid",
      dropdown: "GetSkillCompLevelDropDown",
      parents: (row) => [{ skillcompid: Number(row.skillcompid) || 0 }],
    },
  ],
  // Postman `hrappexplist` is ids only as well. Both job titles read the one
  // 1788-row list — whole: live (2026-09-22) GetJobDropDown ignores `ids`
  // (`ids=7134` still answers every row), so it is fetched once per request
  // and both looked up in it. A business type the list lacks is
  // `businesstypeid` left out + `businesstypenametext` (no list label).
  experience: [
    { name: "jobname", id: "jobid", dropdown: "GetJobDropDown" },
    { name: "businesstypename", id: "businesstypeid", dropdown: "GetBusinessTypeDropDown" },
    { name: "headjobname", id: "headjobid", dropdown: "GetJobDropDown" },
  ],
  // Postman `hrappfamilylist` is ids only as well. Оршин суугаа газар is the
  // profile's chain: the province list read under the row's country, the
  // district list under its province (live 2026-09-23: none → no rows).
  family: [
    { name: "relativename", id: "relativeid", dropdown: "GetRelativeDropDown" },
    { name: "countryname", id: "countryid", dropdown: "GetCountryDropDown" },
    {
      name: "divisionname",
      id: "divisionid",
      dropdown: "GetDivisionDropDown",
      parents: (row) => [{ countryid: row.countryid }],
    },
    {
      name: "districtname",
      id: "districtid",
      dropdown: "GetDistrictDropDown",
      parents: (row) => [{ divisionid: row.divisionid }],
    },
    { name: "professionname", id: "professionid", dropdown: "GetProfessionDropDown" },
    { name: "jobname", id: "jobid", dropdown: "GetJobDropDown" },
  ],
  // Postman `getInterestedJobsList` is ids only as well (entryid, posgroupid,
  // positionid, depid). Both lists take `search` only, so each is read whole.
  // A group-only interest has no position (null) and so no position label.
  interests: [
    { name: "posgroupname", id: "posgroupid", dropdown: "getPosGroupDropdown" },
    { name: "positionname", id: "positionid", dropdown: "getPositionsDropdown" },
  ],
};

const noId = (value: unknown) => value === null || value === undefined || value === "" || Number(value) === 0;

async function labelOf(spec: LabelSpec, row: Row, label: Label): Promise<string> {
  if (noId(row[spec.id])) return "";
  for (const parent of spec.parents?.(row) ?? [undefined]) {
    const text = await label(spec.dropdown, row[spec.id], parent);
    if (text) return text;
  }
  return "";
}

/**
 * `row` with its labels (see `SECTION_LABELS`). A save re-labels every one —
 * its ids may have changed; `keep` fills only the labels a row lacks, so a
 * name the ERP does send is left as it is.
 */
export async function labelRow(section: SectionKey, row: Row, label: Label, keep = false): Promise<Row> {
  const specs = SECTION_LABELS[section] ?? [];
  const labelled: Row = { ...row };
  for (const spec of specs) {
    if (keep && (noId(row[spec.id]) || (typeof row[spec.name] === "string" && row[spec.name] !== ""))) continue;
    labelled[spec.name] = await labelOf(spec, row, label);
  }
  return labelled;
}

/**
 * Fills the missing labels of every section row in fetched ERP sources, in
 * place (`sources` as `ErpSnapshot.sources`). A failed lookup leaves the row
 * as it came.
 */
export async function labelSources(sources: Record<string, unknown>, label: Label): Promise<void> {
  for (const config of SECTIONS) {
    if (!SECTION_LABELS[config.key] || !(config.source in sources)) continue;
    const source = sources[config.source];
    const list = sectionList(config, source);
    if (!list) continue;
    const labelled = await Promise.all(
      list.map((row) => labelRow(config.key, row, label, true).catch(() => row)),
    );
    if (config.listKey) (source as Row)[config.listKey] = labelled;
    else sources[config.source] = labelled;
  }
}

type AppErp = {
  status: string;
  attempts?: number;
  lastAttemptAt?: string;
  erpEntryId?: number;
  error?: string;
  claimedAt?: string;
};

const appErp = (row: Row) =>
  row.erp && typeof row.erp === "object" ? (row.erp as AppErp) : undefined;

/** The ERP id of an application row, when known. */
export function erpIdOfApplication(row: Row): number | undefined {
  const known = appErp(row)?.erpEntryId;
  if (known) return known;
  return !isLocalId(row.entryid) && Number(row.entryid) > 0 ? Number(row.entryid) : undefined;
}

/**
 * ERP request list + local applications not sent yet. A sent local row whose
 * ERP id is in the list is folded into that row (keeping fields only we know,
 * like `recruitmentorderid`); other sent rows are represented by the list.
 */
export function mergeApplications(
  current: Row[],
  erpRows: Row[],
  deletes: PendingDelete[] | undefined,
  now: Date,
): Row[] {
  const gone = deletedIds(deletes, "DeleteOrderApp");
  const result = erpRows
    .filter((row) => !gone.has(Number(row.entryid)))
    .map(
      (row) =>
        ({
          ...stripAudit(row),
          erp: {
            status: "sent",
            attempts: 0,
            lastAttemptAt: now.toISOString(),
            erpEntryId: Number(row.entryid),
          },
        }) as Row,
    );
  for (const row of current) {
    const erp = appErp(row);
    if (erp?.status === "sent") {
      const id = erpIdOfApplication(row);
      const target = result.find((r) => Number(r.entryid) === id);
      if (!target) continue;
      for (const [key, value] of Object.entries(row)) {
        if (key !== "entryid" && key !== "erp" && target[key] === undefined) target[key] = value;
      }
      continue;
    }
    result.push(row);
  }
  return result;
}

/* --- profile & files ---------------------------------------------------- */

/** Profile fields `SaveHrApplicant` takes (see `ProfileInput`). */
export const PROFILE_KEYS = [
  "lastname",
  "firstname",
  "regno",
  "mobilephone",
  "maritalstatus",
  "email2",
  "addr2",
  "countryid",
  "divisionid",
  "districtid",
  "contactname",
  "relativeid",
  "contactphone",
  "contactname2",
  "relativeid2",
  "contactphone2",
  "custom1",
  "custom2",
] as const;

/**
 * Never sent blank: the ERP login and the applicant's name. A blank here
 * means "not known yet", not "cleared", so the ERP keeps its own value.
 */
export const NEVER_BLANK = new Set(["lastname", "firstname", "regno", "mobilephone"]);

/** Profile fields an applicant can empty, and the ERP then has to empty too. */
export const CLEARABLE_KEYS: readonly string[] = PROFILE_KEYS.filter((key) => !NEVER_BLANK.has(key));

/**
 * The `/get` reply's `maritalstatus[]` as `{ key, text }` options, or null
 * when it carries no usable list. Rows the ERP spells `code`/`name` are
 * accepted too — the collection has no saved example of this list.
 */
export function maritalOptionsOf(list: unknown): MaritalOption[] | null {
  if (!Array.isArray(list)) return null;
  const options = list.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Row;
    const key = str(r.key ?? r.code ?? r.value);
    const text = str(r.text ?? r.name ?? r.description);
    return key && text ? [{ key, text }] : [];
  });
  return options.length ? options : null;
}

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

const NOT_PULLED = new Set(["filedata", "picturedata", "filename", "maritalOptions"]);
/**
 * The ERP login (`auth/login {regNo, mobile}`): регистр + утас, where the утас
 * is the password (Postman 02 — the phone at first, a new password once
 * changed). The ERP record's `mobilephone` is the contact number and can differ
 * from it, so a pull never writes either over a stored D1 value: a pull only
 * ever runs with a token those D1 values just earned.
 */
const CREDENTIALS = new Set(["regno", "mobilephone"]);

const isBlank = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === "";

/**
 * The ERP record over the D1 profile, minus files, percentages and audit, and
 * never over a stored регистр / утас (`CREDENTIALS`). `keepD1` (the first
 * pull): a blank ERP value never replaces a D1 one; the return says whether D1
 * kept anything the ERP lacks (so it gets sent).
 */
export function pulledProfile(profile: Row, record: Row, keepD1 = false): { profile: Row; d1Only: boolean } {
  const next = { ...profile };
  let d1Only = false;
  for (const [key, value] of Object.entries(stripAudit(record))) {
    if (NOT_PULLED.has(key) || key.endsWith("per")) continue;
    if (value === null || value === undefined) continue;
    const blank = isBlank(value);
    // The login needs these: an ERP value (blank, or the contact number) never replaces them.
    if (CREDENTIALS.has(key) && !isBlank(next[key])) {
      if (blank) d1Only = true;
      continue;
    }
    if (blank && keepD1) {
      if (!isBlank(next[key])) d1Only = true;
      continue;
    }
    next[key] = value;
  }
  // D1 values in fields the ERP record leaves out entirely.
  for (const key of PROFILE_KEYS) {
    if (keepD1 && isBlank(record[key]) && !isBlank(next[key])) d1Only = true;
  }
  return { profile: next, d1Only: keepD1 && d1Only };
}

export const hashOf = (data: string) => createHash("sha256").update(data).digest("hex");

export const asDataUrl = (data: string) =>
  data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`;

/* --- snapshot merge ----------------------------------------------------- */

/** What one pull fetched; null parts failed or were not fetched. */
export type ErpSnapshot = {
  record: Row | null;
  /** `/get`'s `maritalstatus[]` option list (null: absent or unusable). */
  maritalOptions?: MaritalOption[] | null;
  recruitmentorders: Row[] | null;
  sources: Record<string, unknown>;
  applications: Row[] | null;
};

export type SnapshotEffect = { cv: boolean; picture: boolean };

/**
 * Merges a pull into the document. The profile is left alone while a local
 * edit is unpushed; files only change when their content hash changed and no
 * local upload is waiting. Returns which files `saveAccount` must write.
 */
export function applySnapshot(doc: ApplicantDoc, snap: ErpSnapshot, now: Date): SnapshotEffect {
  const erp: DocErp = (doc.erp ??= {});
  const effect: SnapshotEffect = { cv: false, picture: false };

  if (snap.record && !erp.profileDirty) {
    const first = !erp.pulledAt;
    const pulled = pulledProfile(doc.profile, snap.record, first);
    doc.profile = pulled.profile;
    if (pulled.d1Only) erp.profileDirty = Date.now();
  }

  if (snap.maritalOptions?.length) erp.maritalOptions = snap.maritalOptions;

  if (snap.recruitmentorders) {
    erp.appliedOrderIds = snap.recruitmentorders
      .map((row) => Number(row.recruitmentorderid))
      .filter((id) => id > 0);
  }

  for (const config of SECTIONS) {
    if (!(config.source in snap.sources)) continue;
    const list = sectionList(config, snap.sources[config.source]);
    if (!list) continue; // unusable answer: keep D1 as it is
    // Rows saved into the ERP before without their ids: adopt them first, so an
    // edit made here since lands on its ERP row instead of beside it.
    const adoption = planAdoption(doc, config, list);
    if (adoption) applyAdoption(doc, config.key, adoption);
    doc[config.key] = mergeSection(config, doc[config.key], list, erp.pendingDeletes);
  }

  if (snap.applications) {
    doc.applications = mergeApplications(doc.applications, snap.applications, erp.pendingDeletes, now);
  }

  if (snap.record) {
    effect.cv = pullCv(doc, erp, snap.record);
    effect.picture = pullPicture(doc, erp, snap.record);
  }

  erp.pulledAt = now.toISOString();
  erp.pullFailures = 0;
  delete erp.pullFailedAt;
  return effect;
}

function pullCv(doc: ApplicantDoc, erp: DocErp, record: Row): boolean {
  if (erp.cvDirty) return false;
  const data = typeof record.filedata === "string" ? record.filedata : "";
  if (data) {
    const hash = hashOf(data);
    if (hash === erp.cvHash && doc.cv) return false;
    doc.cv = { filename: String(record.filename ?? "cv"), filedata: data };
    erp.cvHash = hash;
    return true;
  }
  if (!doc.cv) return false;
  if (erp.cvHash) {
    // It was in sync and the ERP no longer has it: removed there.
    doc.cv = null;
    delete erp.cvHash;
    return true;
  }
  erp.cvDirty = Date.now(); // uploaded here, never pushed
  return false;
}

function pullPicture(doc: ApplicantDoc, erp: DocErp, record: Row): boolean {
  if (erp.pictureDirty) return false;
  const raw = typeof record.picturedata === "string" ? record.picturedata : "";
  if (raw) {
    const data = asDataUrl(raw);
    const hash = hashOf(data);
    if (hash === erp.pictureHash && doc.picture !== null) return false;
    doc.picture = data;
    erp.pictureHash = hash;
    return true;
  }
  if (doc.picture !== null && !erp.pictureHash) erp.pictureDirty = Date.now();
  return false;
}

/**
 * Before the first pull: rows already in D1 were entered here, so they are
 * local work — they become pending (re-numbered into the local range when their
 * old ids could collide with ERP ids), and applications without push state
 * become pending. The profile is reconciled field by field in `applySnapshot`.
 */
export function migrateForFirstPull(doc: ApplicantDoc, nextId: () => number): void {
  const erp: DocErp = (doc.erp ??= {});
  if (erp.pulledAt) return;
  for (const config of SECTIONS) {
    for (const row of doc[config.key]) {
      if (row.erp === "synced" || row.erp === "pending") continue;
      row.erp = "pending";
      if (!isLocalId(row.entryid)) row.entryid = nextId();
    }
  }
  for (const row of doc.applications) {
    if (appErp(row)) continue;
    if (!isLocalId(row.entryid)) row.entryid = nextId();
    row.erp = { status: "pending", attempts: 0, lastAttemptAt: new Date(0).toISOString() };
  }
}

/* --- local changes ------------------------------------------------------ */

/**
 * Records a successful /api/me mutation for the next flush. `removed` is the
 * row a delete endpoint removed (looked up before the handler ran).
 */
export function recordLocalChange(
  doc: ApplicantDoc,
  endpoint: string,
  retdata: unknown,
  removed: Row | undefined,
  now = Date.now(),
): boolean {
  const erp: DocErp = (doc.erp ??= {});
  const queueDelete = (target: string, id: number | undefined) => {
    if (!id) return; // local-only: dropping the row drops its pending save
    const list = (erp.pendingDeletes ??= []);
    if (!list.some((d) => d.endpoint === target && d.entryid === id)) {
      list.push({ endpoint: target, entryid: id });
    }
  };

  if (endpoint === "SaveHrApplicant") {
    erp.profileDirty = now;
  } else if (endpoint === "SaveAppCV") {
    erp.cvDirty = now;
  } else if (endpoint === "deleteAppCV") {
    // Only an ERP-held CV needs deleting there; a local-only one just goes.
    if (erp.cvHash) erp.cvDirty = now;
    else delete erp.cvDirty;
  } else if (endpoint === "SaveAppPicture") {
    erp.pictureDirty = now;
  } else if (endpoint === "DeleteOrderApp") {
    queueDelete(endpoint, removed ? erpIdOfApplication(removed) : undefined);
  } else if (sectionByRemove(endpoint)) {
    queueDelete(endpoint, removed && !isLocalId(removed.entryid) ? Number(removed.entryid) : undefined);
  } else if (sectionBySave(endpoint)) {
    const rows = Array.isArray(retdata) ? retdata : retdata ? [retdata] : [];
    for (const row of rows as Row[]) row.erp = "pending";
  } else {
    return false;
  }
  erp.flush = undefined; // new work: a fresh set of attempts
  return true;
}

/** Local non-application work waiting for the ERP. */
export function hasLocalWork(doc: ApplicantDoc): boolean {
  const erp = doc.erp;
  if (erp?.profileDirty || erp?.cvDirty || erp?.pictureDirty) return true;
  if (erp?.pendingDeletes?.length) return true;
  return SECTIONS.some((s) => s.save && doc[s.key].some((row) => row.erp === "pending"));
}

/* --- retry policy ------------------------------------------------------- */

export const MAX_ATTEMPTS = 5;
export const RETRY_FAILED_AFTER_MS = 10 * 60_000;
export const RETRY_PENDING_AFTER_MS = 60_000;
export const PULL_EVERY_MS = 10 * 60_000;
export const CLAIM_TTL_MS = 2 * 60_000;

const age = (iso: string | undefined, now: number) => {
  const at = Date.parse(iso ?? "");
  return Number.isFinite(at) ? now - at : Infinity;
};

/** The non-application flush is due (same cap and backoff as applications). */
export function flushDue(doc: ApplicantDoc, now = Date.now()): boolean {
  if (!hasLocalWork(doc)) return false;
  const flush = doc.erp?.flush;
  if (!flush) return true;
  if (age(flush.claimedAt, now) < CLAIM_TTL_MS) return false;
  if (flush.attempts >= MAX_ATTEMPTS) return false;
  return age(flush.lastAttemptAt, now) >= RETRY_FAILED_AFTER_MS;
}

/** Backoff after failed pulls: 10 min, doubling, capped at a day. */
export function pullDue(doc: ApplicantDoc, now = Date.now()): boolean {
  const erp = doc.erp ?? {};
  const failures = erp.pullFailures ?? 0;
  if (failures > 0) {
    const wait = Math.min(PULL_EVERY_MS * 2 ** (failures - 1), 24 * 60 * 60_000);
    if (age(erp.pullFailedAt, now) < wait) return false;
  }
  return age(erp.pulledAt, now) >= PULL_EVERY_MS;
}

/* --- ERP account link ---------------------------------------------------- */

/**
 * Fingerprint of a регистр + утас pair, so a refusal can be tied to the exact
 * credentials the ERP refused (the values themselves are not copied).
 */
export const credentialKey = (profile: Row) =>
  hashOf(`${normalizeRegno(profile.regno)}|${normalizePhone(profile.mobilephone)}`);

/** The ERP already refused the регистр + утас stored now: do not send them again. */
export const linkRefused = (doc: ApplicantDoc) =>
  !!doc.erp?.linkError && doc.erp.linkKey === credentialKey(doc.profile);

/** Worth talking to the ERP at all: all four identity fields, not already refused. */
export const erpReady = (doc: ApplicantDoc) => isIdentityComplete(doc.profile) && !linkRefused(doc);

/**
 * The регистр this account is linked to in the ERP ("" = not linked). Set at
 * the first token; documents pulled before that was recorded count as linked
 * to their stored регистр.
 */
export const linkedRegno = (doc: ApplicantDoc) =>
  doc.erp?.linkedRegno ?? (doc.erp?.pulledAt ? normalizeRegno(doc.profile.regno) : "");

/**
 * A token was issued for `regno` + `phone`: linked, `phone` is the ERP
 * password now, and any refusal or claim is over.
 */
export function markLinked(doc: ApplicantDoc, regno: unknown, phone?: string, now = new Date()): void {
  const erp = (doc.erp ??= {});
  erp.linkedRegno ??= normalizeRegno(regno);
  erp.linkedAt ??= now.toISOString();
  if (phone) erp.loginPhone = phone;
  delete erp.linkError;
  delete erp.linkKey;
  delete erp.registeringAt;
}

/** Another request is registering this applicant (SaveHrAppUser in flight). */
export const registering = (doc: ApplicantDoc, now = Date.now()) =>
  age(doc.erp?.registeringAt, now) < CLAIM_TTL_MS;

/** A sync task for this account is already scheduled and has not started. */
export const syncScheduled = (doc: ApplicantDoc, now = Date.now()) =>
  age(doc.erp?.scheduledAt, now) < CLAIM_TTL_MS;
