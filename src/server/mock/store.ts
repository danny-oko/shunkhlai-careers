import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  defaultCountry,
  dropdowns,
  filterData,
  listRow,
  parentOf,
  postings,
} from "./data";
import {
  type ApplicantDoc,
  type Row,
  completion,
  removeRow,
  upsertRow,
} from "@/server/applicant/handlers";

export type { Row };
export { completion, removeRow };

/** A mock ERP account: the shared applicant document plus its credentials. */
export type Account = ApplicantDoc & {
  id: number;
  regno: string;
  password: string;
};

type Db = {
  accounts: Map<string, Account>;
  sessions: Map<string, string>;
  nextAccountId: number;
  nextEntryId: number;
};

const globalRef = globalThis as typeof globalThis & { __careersMockDb?: Db };
const persists = process.env.NODE_ENV !== "production";

const dbFile = join(process.cwd(), ".mock-data", "db.json");

type PersistedDb = {
  accounts: [string, Account][];
  sessions: [string, string][];
  nextAccountId: number;
  nextEntryId: number;
};

function emptyDb(): Db {
  return {
    accounts: new Map(),
    sessions: new Map(),
    nextAccountId: 1,
    nextEntryId: 1000,
  };
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
    return emptyDb();
  }
}
export function saveDb(): void {
  if (!persists) return;
  try {
    mkdirSync(dirname(dbFile), { recursive: true });
    const saved: PersistedDb = {
      accounts: [...db.accounts],
      sessions: [...db.sessions],
      nextAccountId: db.nextAccountId,
      nextEntryId: db.nextEntryId,
    };
    const pending = `${dbFile}.tmp`;
    writeFileSync(pending, JSON.stringify(saved), "utf8");
    renameSync(pending, dbFile);
  } catch {
    // console.log(error);
  }
}

export const db: Db =
  globalRef.__careersMockDb ?? (globalRef.__careersMockDb = loadDb());

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

export function issueToken(account: Account): {
  access_token: string;
  refresh_token: string;
} {
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
  return upsertRow(rows, entry, nextEntryId);
}

/** Resolves a dropdown key to its label, so saved rows can show names too. */
export function labelFor(dropdown: string, key: unknown): string {
  if (key === null || key === undefined || key === "") return "";
  const row = dropdowns[dropdown]?.find(
    (item) => String(item.key) === String(key),
  );
  return row ? String(row.text) : "";
}
export function dropdownRows(name: string, params: URLSearchParams): Row[] {
  const rows = dropdowns[name] ?? [];
  const parent = parentOf[name];
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const ids = params.getAll("ids").filter(Boolean);
  const lfr = params.get("lfr") === "true";

  let result = rows;

  if (parent) {
    const value = Number(params.get(parent.param) ?? 0);
    if (Number.isFinite(value) && value !== 0) {
      result = result.filter((row) => Number(row[parent.param]) === value);
    } else if (parent.required) {
      result = [];
    }
  }

  if (ids.length > 0)
    result = result.filter((row) => ids.includes(String(row.key)));
  if (search)
    result = result.filter((row) =>
      String(row.text).toLowerCase().includes(search),
    );
  if (lfr) result = result.slice(0, 5);

  return result.map((row, index) => {
    const visible: Row = { row_index: index + 1, ...row };
    if (parent) delete visible[parent.param];
    return visible;
  });
}

/* --- postings ---------------------------------------------------------- */

export function jobList(query: { jobName?: string; locationid?: number }) {
  const name = (query.jobName ?? "").trim().toLowerCase();
  const locationName = query.locationid
    ? filterData.location.find(
        (row) => row.entryid === Number(query.locationid),
      )?.name
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
