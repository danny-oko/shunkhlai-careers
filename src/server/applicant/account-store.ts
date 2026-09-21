import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { applicantAccount, applicantFile, applicantProfile, getDb } from "@/lib/db";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * D1 persistence for `/api/me`: one `applicant_account` row per lowercased
 * Clerk email, holding the applicant document as JSON. The CV and photo are
 * kept out of that JSON, in chunked `applicant_file` rows (see schema.ts).
 */

/** What `data_json` holds: the document minus file contents. */
type StoredDoc = Omit<ApplicantDoc, "cv" | "picture"> & {
  cv: { filename: string } | null;
  picture: boolean;
  nextEntryId: number;
};

export type LoadedAccount = {
  email: string;
  doc: ApplicantDoc;
  nextEntryId: number;
  /** Row version (updated_at) at load time; saves are rejected if it moved. */
  version: Date;
};

/** Another request saved the same account between our load and save. */
export class AccountConflictError extends Error {
  constructor() {
    super("applicant_account: concurrent update");
    this.name = "AccountConflictError";
  }
}

type FileKind = "cv" | "picture";

/** D1 caps a row at 2 MB; stay well under it per chunk. */
const CHUNK_CHARS = 500_000;
const FIRST_ENTRY_ID = 1000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/* --- documents ---------------------------------------------------------- */

const LIST_KEYS = [
  "education",
  "languages",
  "qualifications",
  "skills",
  "experience",
  "projects",
  "internships",
  "family",
  "relatives",
  "interests",
  "applications",
] as const;

/** Profile fields a legacy ERP `applicant_profile` snapshot can carry over. */
const LEGACY_PROFILE_KEYS = [
  "lastname",
  "firstname",
  "regno",
  "mobilephone",
  "email2",
  "addr2",
  "maritalstatus",
  "countryid",
  "countryname",
  "divisionid",
  "divisionname",
  "districtid",
  "districtname",
  "contactname",
  "relativeid",
  "relativename",
  "contactphone",
  "contactname2",
  "relativeid2",
  "relativename2",
  "contactphone2",
  "isa",
  "isb",
  "isc",
  "isd",
  "ise",
  "custom1",
  "custom2",
] as const;

export type ClerkIdentity = {
  clerkUserId: string;
  email: string;
  firstname: string;
  lastname: string;
};

function blankProfile(identity: ClerkIdentity): Row {
  return {
    lastname: identity.lastname,
    firstname: identity.firstname,
    regno: "",
    mobilephone: "",
    email2: identity.email,
    addr2: "",
    maritalstatus: "",
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
  };
}

function emptyStored(profile: Row): StoredDoc {
  const lists = Object.fromEntries(LIST_KEYS.map((key) => [key, [] as Row[]]));
  return {
    profile,
    ...(lists as Pick<StoredDoc, (typeof LIST_KEYS)[number]>),
    cv: null,
    picture: false,
    nextEntryId: FIRST_ENTRY_ID,
  };
}

function parseStored(json: string): StoredDoc {
  let raw: Partial<StoredDoc> = {};
  try {
    raw = (JSON.parse(json) ?? {}) as Partial<StoredDoc>;
  } catch {
    raw = {};
  }
  const base = emptyStored((raw.profile as Row) ?? {});
  for (const key of LIST_KEYS) {
    if (Array.isArray(raw[key])) base[key] = raw[key] as Row[];
  }
  base.cv = raw.cv?.filename ? { filename: raw.cv.filename } : null;
  base.picture = raw.picture === true;
  base.nextEntryId = Number(raw.nextEntryId) || FIRST_ENTRY_ID;
  return base;
}

/** Legacy ERP snapshot (`applicant_profile.data_json`) for this Clerk user. */
async function legacySnapshot(clerkUserId: string): Promise<Row | null> {
  const [row] = await getDb()
    .select()
    .from(applicantProfile)
    .where(eq(applicantProfile.clerkUserId, clerkUserId));
  if (!row) return null;
  try {
    const data = JSON.parse(row.dataJson) as unknown;
    return data && typeof data === "object" ? (data as Row) : null;
  } catch {
    return null;
  }
}

function fromLegacy(profile: Row, legacy: Row): Row {
  const merged = { ...profile };
  for (const key of LEGACY_PROFILE_KEYS) {
    const value = legacy[key];
    if (value !== null && value !== undefined && value !== "") merged[key] = value;
  }
  return merged;
}

async function createAccount(email: string, identity: ClerkIdentity): Promise<void> {
  let profile = blankProfile(identity);
  let picture: string | null = null;

  const legacy = await legacySnapshot(identity.clerkUserId).catch(() => null);
  if (legacy) {
    profile = fromLegacy(profile, legacy);
    if (typeof legacy.picturedata === "string" && legacy.picturedata) {
      picture = legacy.picturedata.startsWith("data:")
        ? legacy.picturedata
        : `data:image/jpeg;base64,${legacy.picturedata}`;
    }
  }

  const stored = emptyStored(profile);
  stored.picture = picture !== null;
  const now = new Date();
  await getDb()
    .insert(applicantAccount)
    .values({
      id: crypto.randomUUID(),
      email,
      clerkUserId: identity.clerkUserId,
      dataJson: JSON.stringify(stored),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: applicantAccount.email });

  if (picture) await writeFile(email, "picture", null, picture);
}

/**
 * The applicant document for this Clerk identity, created on first use.
 * File contents are loaded only when `withFiles` is set (the `get` call).
 */
export async function loadAccount(
  identity: ClerkIdentity,
  { withFiles = false }: { withFiles?: boolean } = {},
): Promise<LoadedAccount> {
  const email = normalizeEmail(identity.email);
  const select = () =>
    getDb().select().from(applicantAccount).where(eq(applicantAccount.email, email));

  let [row] = await select();
  if (!row) {
    await createAccount(email, identity);
    [row] = await select();
  }
  if (!row) throw new Error("applicant_account: could not create the account row");

  const stored = parseStored(row.dataJson);
  const { nextEntryId, cv, picture, ...rest } = stored;

  const doc: ApplicantDoc = {
    ...rest,
    cv: cv ? { filename: cv.filename, filedata: "" } : null,
    picture: picture ? "" : null,
  };

  if (withFiles) {
    if (doc.cv) doc.cv.filedata = (await readFile(email, "cv"))?.data ?? "";
    if (picture) doc.picture = (await readFile(email, "picture"))?.data ?? null;
  }

  return { email, doc, nextEntryId, version: row.updatedAt };
}

/** Writes the document back (and the files, when `files` says they changed). */
export async function saveAccount(
  account: LoadedAccount,
  identity: ClerkIdentity,
  nextEntryId: number,
  files: { cv?: boolean; picture?: boolean } = {},
): Promise<void> {
  const { email, doc } = account;

  const { cv, picture, ...rest } = doc;
  const stored: StoredDoc = {
    ...rest,
    cv: cv ? { filename: cv.filename } : null,
    picture: picture !== null,
    nextEntryId,
  };

  // Optimistic lock: only write if nobody saved since we loaded. Otherwise a
  // parallel save (two tabs, two sections) would be silently overwritten.
  let updatedAt = new Date();
  if (updatedAt.getTime() <= account.version.getTime()) {
    updatedAt = new Date(account.version.getTime() + 1);
  }
  const written = await getDb()
    .update(applicantAccount)
    .set({
      dataJson: JSON.stringify(stored),
      clerkUserId: identity.clerkUserId,
      updatedAt,
    })
    .where(
      and(eq(applicantAccount.email, email), eq(applicantAccount.updatedAt, account.version)),
    )
    .returning({ id: applicantAccount.id });
  if (written.length === 0) throw new AccountConflictError();

  if (files.cv) {
    if (doc.cv) await writeFile(email, "cv", doc.cv.filename, doc.cv.filedata);
    else await deleteFile(email, "cv");
  }
  if (files.picture) {
    if (doc.picture) await writeFile(email, "picture", null, doc.picture);
    else await deleteFile(email, "picture");
  }
}

/* --- files -------------------------------------------------------------- */

async function readFile(
  email: string,
  kind: FileKind,
): Promise<{ filename: string | null; data: string } | null> {
  const rows = await getDb()
    .select()
    .from(applicantFile)
    .where(and(eq(applicantFile.email, email), eq(applicantFile.kind, kind)))
    .orderBy(asc(applicantFile.chunkIndex));
  if (rows.length === 0) return null;
  return { filename: rows[0].filename, data: rows.map((row) => row.data).join("") };
}

async function deleteFile(email: string, kind: FileKind): Promise<void> {
  await getDb()
    .delete(applicantFile)
    .where(and(eq(applicantFile.email, email), eq(applicantFile.kind, kind)));
}

async function writeFile(
  email: string,
  kind: FileKind,
  filename: string | null,
  data: string,
): Promise<void> {
  await deleteFile(email, kind);
  const now = new Date();
  for (let index = 0, offset = 0; offset < data.length; index += 1, offset += CHUNK_CHARS) {
    await getDb()
      .insert(applicantFile)
      .values({
        id: crypto.randomUUID(),
        email,
        kind,
        filename,
        chunkIndex: index,
        data: data.slice(offset, offset + CHUNK_CHARS),
        createdAt: now,
      });
  }
}
