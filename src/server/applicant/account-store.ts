import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { applicantAccount, applicantFile, applicantProfile, getDb } from "@/lib/db";
import { mimeFromName } from "@/lib/file-type";
import { parseDataUrl, toDataUrl } from "@/server/files/data-url";
import { type OwnerKind, dropOwnedFile, putOwnedFile, readOwnedFile } from "@/server/files/records";
import { LOCAL_ID_BASE } from "./erp-model";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * PostgreSQL persistence for `/api/me`: one `applicant_account` row per
 * lowercased Clerk email, holding the applicant document as JSON.
 *
 * The CV and the photo are kept out of that JSON and out of the database
 * entirely: their bytes are files under `UPLOAD_DIR` with a `stored_file` row
 * for the metadata (`src/server/files`). They used to be base64 chunks in
 * `applicant_file`, which inflated them by a third and pulled every one of
 * them through Postgres into this process's heap — on a 1.9 GB server, for a
 * 5 MB CV. Those rows are still read for accounts the migration has not moved
 * yet; nothing writes them any more.
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

/**
 * `applicant_file.kind` as `stored_file.owner_kind` spells it. The two names
 * differ because `owner_kind` is shared with the newsroom, where a bare "cv"
 * would say nothing about whose.
 */
const OWNER_KIND: Readonly<Record<FileKind, OwnerKind>> = {
  cv: "applicant_cv",
  picture: "applicant_picture",
};
/**
 * Rows created on this site get ids from `LOCAL_ID_BASE` up, so they can never
 * collide with the ERP's own entry ids (which rows pulled from the ERP keep).
 */
const FIRST_ENTRY_ID = LOCAL_ID_BASE;

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
  // Older documents counted from 1000; move them into the local range.
  base.nextEntryId = Math.max(Number(raw.nextEntryId) || 0, FIRST_ENTRY_ID);
  if (raw.erp && typeof raw.erp === "object") base.erp = raw.erp;
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
 * The photo's contents are loaded only when `withPicture` is set (the `get`
 * call, which shows it). The CV's never are: `get` carries only its name and
 * the file is read on demand (`readCv` — the `/api/me/cv` download, the ERP push).
 */
export async function loadAccount(
  identity: ClerkIdentity,
  { withPicture = false }: { withPicture?: boolean } = {},
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

  if (withPicture && picture) doc.picture = (await readFile(email, "picture"))?.data ?? null;

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
  // Where files go now.
  const stored = await readOwnedFile(OWNER_KIND[kind], email);
  if (stored) {
    return { filename: stored.filename, data: encodeStored(kind, stored) };
  }

  // Not moved yet. Every account whose CV or photo predates this change is
  // read from its chunks exactly as before, so nothing 404s while
  // `scripts/files/move-to-disk.ts` works through them.
  const rows = await getDb()
    .select()
    .from(applicantFile)
    .where(and(eq(applicantFile.email, email), eq(applicantFile.kind, kind)))
    .orderBy(asc(applicantFile.chunkIndex));
  if (rows.length === 0) return null;
  return { filename: rows[0].filename, data: rows.map((row) => row.data).join("") };
}

/**
 * The two kinds keep the string shape their callers have always seen: a CV is
 * bare base64 (`cvResponse` and the ERP push both decode it themselves), a
 * photo is a whole `data:` URL the account page drops into an `<img src>`.
 * Only the storage underneath changed, so neither conversion may.
 */
function encodeStored(kind: FileKind, stored: { bytes: Buffer; contentType: string }): string {
  const base64 = stored.bytes.toString("base64");
  return kind === "picture" ? toDataUrl(stored.contentType, base64) : base64;
}

function decodeStored(
  kind: FileKind,
  filename: string | null,
  data: string,
): { contentType: string; base64: string } {
  // A photo carries its own type in the data URL; a CV's is its extension's,
  // which is the same answer `/api/me/cv` has always served it with.
  if (kind === "picture") return parseDataUrl(data);
  return { contentType: mimeFromName(filename), base64: data };
}

async function deleteFile(email: string, kind: FileKind): Promise<void> {
  await dropOwnedFile(OWNER_KIND[kind], email);
  // The legacy chunks too. A delete that left them behind would be undone by
  // the fallback in `readFile`: the applicant removes their CV, and the next
  // download hands back the one they thought was gone.
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
  // Clears both homes first, so a replacement can never leave the old chunks
  // shadowing the new file.
  await deleteFile(email, kind);

  const { contentType, base64 } = decodeStored(kind, filename, data);
  await putOwnedFile({
    ownerKind: OWNER_KIND[kind],
    ownerKey: email,
    bytes: Buffer.from(base64, "base64"),
    contentType,
    filename,
  });
}

/** The stored CV (base64) for this account, or null — the download and the ERP push. */
export async function readCv(email: string): Promise<{ filename: string; data: string } | null> {
  const file = await readFile(normalizeEmail(email), "cv");
  return file ? { filename: file.filename ?? "cv", data: file.data } : null;
}

/** The stored profile photo (a data URL), or null — used by the ERP flush. */
export async function readPicture(email: string): Promise<string | null> {
  return (await readFile(normalizeEmail(email), "picture"))?.data ?? null;
}
