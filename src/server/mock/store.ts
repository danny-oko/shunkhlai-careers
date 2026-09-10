import { defaultCountry, dropdowns, filterData, listRow, postings } from "./data";

/**
 * In-memory state for the mock backend.
 *
 * It lives on `globalThis` so hot reloads in development do not sign the user
 * out mid-session. Nothing here is persistent — restarting the dev server
 * resets every account, application and CV row, which is exactly what you want
 * from a stand-in for a service that is not wired up yet.
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

export const db: Db =
  globalRef.__careersMockDb ??
  (globalRef.__careersMockDb = {
    accounts: new Map(),
    sessions: new Map(),
    nextAccountId: 1,
    nextEntryId: 1000,
  });

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
