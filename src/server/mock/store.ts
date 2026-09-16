import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { defaultCountry, dropdowns, filterData, listRow, parentOf, postings } from "./data";

/**
 * State for the mock backend: in memory, mirrored to disk in development.
 *
 * It lives on `globalThis` so hot reloads do not sign the user out mid-session,
 * and it is written to `.mock-data/db.json` after every mutating request so a
 * dev-server restart does not either. An account registered against the mock
 * survives a restart, and so do the tokens already issued to it — a browser
 * holding one stays signed in.
 *
 * Development only. A deployed instance has a read-only filesystem, and its
 * accounts belong to the real service rather than here.
 */

export type Row = Record<string, unknown>;

export type Account = {
  id: number;
  regno: string;
  /** Starts life as the phone number, per `SaveHrAppUser`. */
  password: string;
  profile: Row;
  education: Row[];
  languages: Row[];
  qualifications: Row[];
  skills: Row[];
  experience: Row[];
  projects: Row[];
  internships: Row[];
  family: Row[];
  relatives: Row[];
  interests: Row[];
  applications: Row[];
  cv: { filename: string; filedata: string } | null;
  picture: string | null;
};

type Db = {
  accounts: Map<string, Account>;
  sessions: Map<string, string>;
  nextAccountId: number;
  nextEntryId: number;
};

const globalRef = globalThis as typeof globalThis & { __careersMockDb?: Db };

/* --- persistence (development only) ------------------------------------- */

/** Off in production: the filesystem there is read-only. */
const persists = process.env.NODE_ENV !== "production";

const dbFile = join(process.cwd(), ".mock-data", "db.json");

/** `Map`s do not survive `JSON.stringify`, so they travel as entry arrays. */
type PersistedDb = {
  accounts: [string, Account][];
  sessions: [string, string][];
  nextAccountId: number;
  nextEntryId: number;
};

function emptyDb(): Db {
  return { accounts: new Map(), sessions: new Map(), nextAccountId: 1, nextEntryId: 1000 };
}

function loadDb(): Db {
  if (!persists) return emptyDb();
  try {
    const saved = JSON.parse(readFileSync(dbFile, "utf8")) as PersistedDb;
    return {
      accounts: new Map(saved.accounts),
      sessions: new Map(saved.sessions),
      nextAccountId: Number(saved.nextAccountId) || 1,
      nextEntryId: Number(saved.nextEntryId) || 1000,
    };
  } catch {
    // No file yet, or one left by an older shape. Start clean rather than
    // taking the server down over a dev scratch file.
    return emptyDb();
  }
}

/**
 * Writes the store. Called once per mutating request from the route handler,
 * which edits account objects in place — there is no narrower hook that
 * catches every edit.
 *
 * The two base64 blobs — an uploaded CV and the profile picture — are held in
 * memory but deliberately **not** written. They are the bulk of the file and
 * the most sensitive thing in it, and the point of persisting at all is to
 * keep a developer signed in across a restart, which needs the account and its
 * session, not the attachments. The cost is real and visible: after a restart
 * a CV has to be re-uploaded, and the profile completeness on `/account` drops
 * by the 50 points `progress()` gives for one.
 *
 * Delete `.mock-data/` to reset.
 */
export function saveDb(): void {
  if (!persists) return;
  try {
    mkdirSync(dirname(dbFile), { recursive: true });
    const saved: PersistedDb = {
      accounts: [...db.accounts].map(([regno, account]) => [
        regno,
        { ...account, cv: null, picture: null },
      ]),
      sessions: [...db.sessions],
      nextAccountId: db.nextAccountId,
      nextEntryId: db.nextEntryId,
    };
    // Through a temp file: a half-written db.json is unreadable on restart,
    // which would lose every account rather than the one request that failed.
    const pending = `${dbFile}.tmp`;
    writeFileSync(pending, JSON.stringify(saved), "utf8");
    renameSync(pending, dbFile);
  } catch {
    // Persistence is a convenience. A full disk, a read-only mount or a
    // sandboxed CI checkout must not turn into a failed request.
  }
}

export const db: Db = globalRef.__careersMockDb ?? (globalRef.__careersMockDb = loadDb());

export function nextEntryId(): number {
  db.nextEntryId += 1;
  return db.nextEntryId;
}

/* --- accounts ---------------------------------------------------------- */

export function createAccount(input: {
  regno: string;
  lastname: string;
  firstname: string;
  email: string;
  mobilephone: string;
}): Account {
  const account: Account = {
    id: db.nextAccountId++,
    regno: input.regno,
    password: input.mobilephone,
    profile: {
      lastname: input.lastname,
      firstname: input.firstname,
      regno: input.regno,
      mobilephone: input.mobilephone,
      email2: input.email,
      addr2: "",
      maritalstatus: "",
      countryid: defaultCountry.countryid,
      countryname: defaultCountry.countryname,
      divisionid: null,
      divisionname: "",
      districtid: null,
      districtname: "",
      contactname: "",
      relativeid: null,
      relativename: "",
      contactphone: "",
      contactname2: "",
      relativeid2: null,
      relativename2: "",
      contactphone2: "",
    },
    education: [],
    languages: [],
    qualifications: [],
    skills: [],
    experience: [],
    projects: [],
    internships: [],
    family: [],
    relatives: [],
    interests: [],
    applications: [],
    cv: null,
    picture: null,
  };

  db.accounts.set(input.regno, account);
  return account;
}

export function findAccount(regno: string): Account | undefined {
  return db.accounts.get(regno);
}

export function issueToken(account: Account): { access_token: string; refresh_token: string } {
  const access = `mock.${account.id}.${Math.random().toString(36).slice(2, 12)}`;
  const refresh = `mockr.${account.id}.${Math.random().toString(36).slice(2, 12)}`;
  db.sessions.set(access, account.regno);
  db.sessions.set(refresh, account.regno);
  return { access_token: access, refresh_token: refresh };
}

export function accountFromToken(token: string | null): Account | null {
  if (!token) return null;
  const regno = db.sessions.get(token);
  return regno ? (db.accounts.get(regno) ?? null) : null;
}

/* --- row helpers ------------------------------------------------------- */

/** `entryid: 0` inserts, anything else updates in place. */
export function upsert(rows: Row[], entry: Row): Row {
  const entryid = Number(entry.entryid ?? 0);
  if (entryid > 0) {
    const index = rows.findIndex((row) => Number(row.entryid) === entryid);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...entry };
      return rows[index];
    }
  }
  const created = { ...entry, entryid: nextEntryId() };
  rows.push(created);
  return created;
}

export function removeRow(rows: Row[], entryid: number): boolean {
  const index = rows.findIndex((row) => Number(row.entryid) === entryid);
  if (index < 0) return false;
  rows.splice(index, 1);
  return true;
}

/** Resolves a dropdown key to its label, so saved rows can show names too. */
export function labelFor(dropdown: string, key: unknown): string {
  if (key === null || key === undefined || key === "") return "";
  const row = dropdowns[dropdown]?.find((item) => String(item.key) === String(key));
  return row ? String(row.text) : "";
}

/* --- dropdowns --------------------------------------------------------- */

/**
 * One dropdown's rows for one request.
 *
 * The three filters narrow rather than replace one another: a combobox that
 * has a country chosen and a word typed means both, and resolving a saved id
 * still has to respect the parent it was saved under. Answering the whole
 * table to any of them is what made the cascade cosmetic — the child list
 * reloaded on every parent change and came back identical.
 */
export function dropdownRows(name: string, params: URLSearchParams): Row[] {
  const rows = dropdowns[name] ?? [];
  const parent = parentOf[name];
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const ids = params.getAll("ids").filter(Boolean);
  const lfr = params.get("lfr") === "true";

  let result = rows;

  if (parent) {
    const value = Number(params.get(parent.param) ?? 0);
    // `0` and an absent parameter both mean "every row" where the collection
    // allows it; where the parent is required they mean the applicant has not
    // chosen one yet, so there is nothing to offer.
    if (Number.isFinite(value) && value !== 0) {
      result = result.filter((row) => Number(row[parent.param]) === value);
    } else if (parent.required) {
      result = [];
    }
  }

  if (ids.length > 0) result = result.filter((row) => ids.includes(String(row.key)));
  if (search) result = result.filter((row) => String(row.text).toLowerCase().includes(search));
  if (lfr) result = result.slice(0, 5);

  return result.map((row, index) => {
    const visible: Row = { row_index: index + 1, ...row };
    if (parent) delete visible[parent.param];
    return visible;
  });
}

/* --- profile completion ------------------------------------------------ */

/** The percentages `/api/applicant/get` reports for the progress meter. */
export function completion(account: Account) {
  const profile = account.profile;
  const personalFields = [
    profile.lastname,
    profile.firstname,
    profile.regno,
    profile.mobilephone,
    profile.email2,
    profile.addr2,
    profile.divisionid,
    profile.districtid,
    profile.contactname,
    profile.contactphone,
  ];
  const filled = personalFields.filter((value) => value !== null && value !== undefined && value !== "").length;
  const persinfoper = Math.round((filled / personalFields.length) * 100);

  const educationper = Math.min(
    100,
    account.education.length * 50 + account.languages.length * 25 + account.skills.length * 25,
  );
  const experienceper = Math.min(100, account.experience.length * 50);
  const familyper = Math.min(100, account.family.length * 50);
  const distinctper = Math.min(100, account.interests.length * 50 + (account.cv ? 50 : 0));

  const totalper = Math.round(
    (persinfoper + educationper + experienceper + familyper + distinctper) / 5,
  );

  return { persinfoper, educationper, experienceper, familyper, distinctper, totalper };
}

/* --- postings ---------------------------------------------------------- */

export function jobList(query: { jobName?: string; locationid?: number }) {
  const name = (query.jobName ?? "").trim().toLowerCase();
  const locationName = query.locationid
    ? filterData.location.find((row) => row.entryid === Number(query.locationid))?.name
    : undefined;

  return postings
    .filter((posting) => !name || posting.posname.toLowerCase().includes(name))
    .filter((posting) => !locationName || posting.locname === locationName)
    .map(listRow);
}

export function jobItem(entryID: number) {
  const posting = postings.find((row) => row.entryid === entryID);
  if (!posting) return null;

  const { mainresp, mainreq, ...order } = posting;
  return {
    hrrecruitmentorder: [
      {
        ...order,
        orderreq: JSON.stringify(mainreq.map((text) => ({ text }))),
        orderres: JSON.stringify(mainresp.map((text) => ({ text }))),
      },
    ],
    mainresp: mainresp.map((name) => ({ name })),
    mainreq: mainreq.map((name) => ({ name })),
  };
}

export { defaultCountry, dropdowns, filterData, postings };
