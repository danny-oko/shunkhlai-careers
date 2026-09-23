/**
 * The applicant personal-data endpoints, independent of storage.
 *
 * Both backends that answer on the ERP's paths share this: the dev mock
 * (`/api/applicant/*`, in-memory accounts) and `/api/me/*` (one D1 document per
 * Clerk email). Each call gets the parsed request and the applicant's document,
 * edits the document in place and says whether it did, and returns the ERP's
 * `{ rettype, retmsg, retdata }` envelope plus an HTTP status.
 *
 * Anything that depends on where reference data lives — resolving a dropdown
 * key to its label, reading a posting — comes in through `deps`, so the mock
 * keeps its bundled data and `/api/me` can follow the live ERP.
 */

import { RETRY_LINK_FLAG, isIdentityComplete, normalizePhone, normalizeRegno } from "@/lib/applicant-identity";
import type { MaritalOption } from "@/lib/api/profile";
import {
  INTEREST_DUPLICATE_MESSAGE,
  INTEREST_GROUP_REQUIRED_MESSAGE,
  sameInterest,
} from "@/lib/interested-job";
import { CLEARABLE_KEYS, type Unadopted, labelRow, linkRefused, linkedRegno } from "./erp-model";

export type Row = Record<string, unknown>;

/** Everything one applicant owns. The mock `Account` is a superset of this. */
export type ApplicantDoc = {
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
  /**
   * The mock holds the bytes here; `/api/me` loads only the name (`filedata`
   * is "" unless this request uploaded it — the file is read by `readCv`).
   */
  cv: { filename: string; filedata: string } | null;
  picture: string | null;
  /** ERP sync state (`/api/me` only; see `erp-sync.ts`). */
  erp?: DocErp;
};

/** A queued ERP delete: the endpoint and the ERP's own entry id. */
export type PendingDelete = { endpoint: string; entryid: number };

/**
 * Two-way ERP sync bookkeeping, kept inside the document (`data_json`).
 * `*Dirty` values are stamps (ms) of the latest local change not yet pushed;
 * a flush clears one only if it is still the stamp it pushed.
 */
export type DocErp = {
  /** Hash of the CV / photo content D1 and the ERP last agreed on. */
  cvHash?: string;
  pictureHash?: string;
  /** The applicant saved their profile on this site at least once. */
  profileEdited?: boolean;
  profileDirty?: number;
  cvDirty?: number;
  pictureDirty?: number;
  /** Deletes of ERP rows made here, waiting to be sent. */
  pendingDeletes?: PendingDelete[];
  /** Last successful pull (ISO) and pull failure backoff. */
  pulledAt?: string;
  pullFailures?: number;
  pullFailedAt?: string;
  /** Write-through attempts for the non-application work. */
  flush?: { attempts: number; lastAttemptAt: string; error?: string; claimedAt?: string };
  /** A sync task was scheduled and has not started yet (dedupes scheduling). */
  scheduledAt?: string;
  /** Postings the ERP says this applicant already applied to (`/get`). */
  appliedOrderIds?: number[];
  /**
   * The ERP's refusal of a регистр + утас (SaveHrAppUser's "…зөрж байна!") and
   * the `credentialKey` of the pair it refused. While the stored pair still
   * has that key nothing is sent to the ERP; changing either value lifts it.
   */
  linkError?: string;
  linkKey?: string;
  /** The регистр the ERP account was linked to at the first token, and when. */
  linkedRegno?: string;
  linkedAt?: string;
  /** A SaveHrAppUser is in flight (ISO): no second one for this applicant. */
  registeringAt?: string;
  /**
   * The утас the ERP last accepted as the password (the pair that earned a
   * token). When the stored утас differs, the next login changes the ERP
   * password to it first (`changeUserInfo`). Server-only: never in a response.
   */
  loginPhone?: string;
  /**
   * Profile fields the applicant emptied here that the ERP may still hold.
   * The flush sends them cleared (SaveHrApplicant is a full replace); gone
   * once that save went through.
   */
  profileCleared?: string[];
  /** The ERP's `maritalstatus[]` option list, from the last pull of `/get`. */
  maritalOptions?: MaritalOption[];
  /**
   * Rows (per section) the ERP accepted in a save whose re-read then failed:
   * the ERP holds them under ids not known here yet. Each keeps the body it
   * was saved with, so the next pull or flush can find its ERP row by content
   * and adopt that id before anything is sent again (`planAdoption`).
   */
  unadopted?: Partial<Record<string, Unadopted[]>>;
};

export type Envelope = {
  totalrow: number;
  affectedrows: number;
  retdata: unknown;
  rettype: number;
  depfilter: null;
  retparams: null;
  retmsg: string;
  traceno: number;
};

export type HandlerResult = { envelope: Envelope; status: number; mutated: boolean };

/** A posting's order row, as `getRecruitmentOrderItem.hrrecruitmentorder[0]`. */
export type JobOrderRow = {
  posname?: unknown;
  companyname?: unknown;
  locname?: unknown;
  salarylevel?: unknown;
  [key: string]: unknown;
};

export type HandlerDeps = {
  /** Next row id; `entryid: 0` saves take one. */
  nextEntryId: () => number;
  /**
   * The label for a dropdown key ("" when unknown). `parent` carries the
   * parent id for dependent lists (district → divisionid, …).
   */
  label: (dropdown: string, key: unknown, parent?: Row) => string | Promise<string>;
  /** The posting's order row, or null when there is no such posting. */
  jobOrder: (entryID: number) => JobOrderRow | null | Promise<JobOrderRow | null>;
};

export type HandlerRequest = {
  endpoint: string;
  method: "GET" | "POST";
  query: URLSearchParams;
  /** The parsed JSON body (POST), or null. */
  body: unknown;
  /** The uploaded file for `SaveAppPicture` / `SaveAppCV`, base64-encoded. */
  upload?: { name: string; data: string } | null;
};

/** Endpoints whose body is `multipart/form-data` rather than JSON. */
export const UPLOAD_ENDPOINTS = new Set(["SaveAppPicture", "SaveAppCV"]);

export function envelopeOk(
  retdata: unknown,
  affectedrows = Array.isArray(retdata) ? retdata.length : 1,
): Envelope {
  return {
    totalrow: 0,
    affectedrows,
    retdata,
    rettype: 0,
    depfilter: null,
    retparams: null,
    retmsg: "",
    traceno: 0,
  };
}

export function envelopeFail(retmsg: string, rettype = 1): Envelope {
  return {
    totalrow: 0,
    affectedrows: 0,
    retdata: null,
    rettype,
    depfilter: null,
    retparams: null,
    retmsg,
    traceno: 0,
  };
}

export const UNAUTHORIZED_MESSAGE = "Нэвтрэх шаардлагатай.";

export const SCHOOL_REQUIRED_MESSAGE = "Сургуулиа жагсаалтаас сонгох эсвэл нэрийг нь бичнэ үү.";

export const LANGUAGE_REQUIRED_MESSAGE = "«Гадаад хэл» талбарыг бөглөнө үү.";

export const SKILL_REQUIRED_MESSAGE = "Программаа жагсаалтаас сонгох эсвэл нэрийг нь бичнэ үү.";

export const EXPERIENCE_ORG_REQUIRED_MESSAGE = "«Байгууллагын нэр» талбарыг бөглөнө үү.";

export const EXPERIENCE_JOB_REQUIRED_MESSAGE = "«Албан тушаал» талбарыг бөглөнө үү.";

export const FAMILY_REQUIRED_MESSAGE = "Гэр бүлийн гишүүн бүрийн «Таны хэн болох», «Нэр» талбарыг бөглөнө үү.";

const ok = (retdata: unknown, mutated = false): HandlerResult => ({
  envelope: envelopeOk(retdata),
  status: 200,
  mutated,
});

const fail = (retmsg: string, status = 200): HandlerResult => ({
  envelope: envelopeFail(retmsg),
  status,
  mutated: false,
});

function num(value: string | null, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* --- row helpers ------------------------------------------------------- */

/**
 * `entryid: 0` inserts, anything else updates in place. An update REPLACES the
 * stored row with the body: the form leaves an emptied optional field out
 * (never `null`, see `section-payload.ts`), so a key the body lacks is a
 * cleared one — merged, the old value would stay in D1 and go back to the ERP.
 * Only what the body cannot speak for is kept: the row's id and its sync
 * marker (`erp`, ours — the list echoes it, and a body never sets it).
 */
export function upsertRow(rows: Row[], entry: Row, nextId: () => number): Row {
  const { erp: _echoed, ...fields } = entry;
  const entryid = Number(entry.entryid ?? 0);
  if (entryid > 0) {
    const index = rows.findIndex((row) => Number(row.entryid) === entryid);
    if (index >= 0) {
      const stored = rows[index];
      rows[index] = { ...fields, entryid: stored.entryid, ...("erp" in stored ? { erp: stored.erp } : {}) };
      return rows[index];
    }
  }
  const created = { ...fields, entryid: nextId() };
  rows.push(created);
  return created;
}

export function removeRow(rows: Row[], entryid: number): boolean {
  const index = rows.findIndex((row) => Number(row.entryid) === entryid);
  if (index < 0) return false;
  rows.splice(index, 1);
  return true;
}

function one(rows: Row[], entryid: number): Row | null {
  return rows.find((row) => Number(row.entryid) === entryid) ?? null;
}

export function completion(doc: ApplicantDoc) {
  const profile = doc.profile;
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
  const filled = personalFields.filter(
    (value) => value !== null && value !== undefined && value !== "",
  ).length;
  const persinfoper = Math.round((filled / personalFields.length) * 100);

  const educationper = Math.min(
    100,
    doc.education.length * 50 + doc.languages.length * 25 + doc.skills.length * 25,
  );
  const experienceper = Math.min(100, doc.experience.length * 50);
  const familyper = Math.min(100, doc.family.length * 50);
  const distinctper = Math.min(100, doc.interests.length * 50 + (doc.cv ? 50 : 0));

  const totalper = Math.round(
    (persinfoper + educationper + experienceper + familyper + distinctper) / 5,
  );

  return { persinfoper, educationper, experienceper, familyper, distinctper, totalper };
}

/* --- dispatch ---------------------------------------------------------- */

/** Handles one personal-data call; null when `endpoint` is not one of them. */
export async function handleApplicantRequest(
  request: HandlerRequest,
  doc: ApplicantDoc,
  deps: HandlerDeps,
): Promise<HandlerResult | null> {
  return request.method === "GET"
    ? handleGet(request, doc)
    : handlePost(request, doc, deps);
}

function handleGet({ endpoint, query }: HandlerRequest, doc: ApplicantDoc): HandlerResult | null {
  const entryid = () => num(query.get("entryid"));

  switch (endpoint) {
    case "get":
      return ok({
        ...doc.profile,
        picturedata: doc.picture,
        filename: doc.cv?.filename ?? null,
        filedata: doc.cv?.filedata ?? null,
        ...completion(doc),
        // Linked to an ERP record: the регистр is fixed.
        erplinked: linkedRegno(doc) !== "",
        // The ERP refused the stored регистр + утас (its own message), else null.
        erplinkerror: linkRefused(doc) ? (doc.erp?.linkError ?? null) : null,
        // Гэрлэлтийн байдал options as the ERP lists them (absent: the form's fallback).
        ...(doc.erp?.maritalOptions?.length ? { maritalOptions: doc.erp.maritalOptions } : {}),
      });

    case "GetHrAppEducationData":
      return ok({
        hrappedulist: doc.education,
        hrapplanglist: doc.languages,
        hrappquallist: doc.qualifications,
        hrappcomplist: doc.skills,
      });

    case "GetHrAppExperienceData":
      return ok({
        hrappexplist: doc.experience,
        hrappprojectlist: doc.projects,
        hrappinternlist: doc.internships,
      });

    case "GetHrAppFamilyData":
      return ok({ hrappfamilylist: doc.family, hrapprelativelist: doc.relatives });

    case "GetHrAppEducation":
      return ok(one(doc.education, entryid()));
    case "GetAppForLanguage":
      return ok(one(doc.languages, entryid()));
    case "GetAppSkillComp":
      return ok(one(doc.skills, entryid()));
    case "GetAppExperience":
      return ok(one(doc.experience, entryid()));
    case "GetAppFamily":
      return ok(one(doc.family, entryid()));

    case "getInterestedJobsList":
      return ok(doc.interests);

    case "getRecruitmenRequestList":
      return ok(doc.applications);

    default:
      return null;
  }
}

const blank = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === "";

/**
 * `profileCleared` after this save: fields the body empties that D1 held a
 * value for are added (the ERP may still have it), fields it fills are
 * dropped. A field that was blank here all along is not a clearing — the ERP
 * may hold a value the applicant never saw.
 */
function clearedFields(doc: ApplicantDoc, body: Row): Pick<DocErp, "profileCleared"> {
  const cleared = new Set(doc.erp?.profileCleared ?? []);
  for (const key of CLEARABLE_KEYS) {
    if (!(key in body)) continue;
    if (!blank(body[key])) cleared.delete(key);
    else if (!blank(doc.profile[key])) cleared.add(key);
  }
  return { profileCleared: cleared.size ? [...cleared] : undefined };
}

const asRows = (body: unknown): Row[] =>
  Array.isArray(body) ? (body as Row[]) : body ? [body as Row] : [];

const DELETES: Record<string, { list: keyof ApplicantDoc; missing: string }> = {
  DeleteHrAppEducation: { list: "education", missing: "Мөр олдсонгүй." },
  DeleteAppForLanguage: { list: "languages", missing: "Мөр олдсонгүй." },
  DeleteAppSkillComp: { list: "skills", missing: "Мөр олдсонгүй." },
  DeleteAppExperience: { list: "experience", missing: "Мөр олдсонгүй." },
  DeleteAppFamily: { list: "family", missing: "Мөр олдсонгүй." },
  deleteInterestedJob: { list: "interests", missing: "Мөр олдсонгүй." },
  DeleteOrderApp: { list: "applications", missing: "Хүсэлт олдсонгүй." },
};

async function handlePost(
  { endpoint, query, body: rawBody, upload }: HandlerRequest,
  doc: ApplicantDoc,
  deps: HandlerDeps,
): Promise<HandlerResult | null> {
  const { label, nextEntryId } = deps;
  const upsert = (rows: Row[], entry: Row) => upsertRow(rows, entry, nextEntryId);
  const body = rawBody as Row | null;

  const remove = DELETES[endpoint];
  if (remove) {
    const entryid = num(query.get("entryid") ?? query.get("ENTRYID") ?? query.get("entryID"));
    return removeRow(doc[remove.list] as Row[], entryid)
      ? ok(true, true)
      : fail(remove.missing);
  }

  switch (endpoint) {
    case "SaveHrApplicant": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      // "Try the ERP again" from the identity form / banner: an instruction,
      // not a profile field — taken off the body so it is never stored or sent.
      const retry = body[RETRY_LINK_FLAG] === true;
      delete body[RETRY_LINK_FLAG];
      // A new регистр / утас is stored as the ERP stores and compares it; the
      // same value in another spelling keeps the stored one untouched.
      const normalise = (key: string, as: (value: unknown) => string) => {
        if (!(key in body)) return;
        body[key] = as(body[key]) === as(doc.profile[key]) ? doc.profile[key] : as(body[key]);
      };
      normalise("regno", normalizeRegno);
      normalise("mobilephone", normalizePhone);
      const wasComplete = isIdentityComplete(doc.profile);
      const changed = (key: string) => key in body && body[key] !== doc.profile[key];
      const newCredentials = changed("regno") || changed("mobilephone");
      // A linked account's утас is its ERP password: remember the one the ERP
      // accepted before it changes, so the sync can move the password along.
      // (Accounts linked before this was recorded — no stored refusal means
      // the stored утас still logs in.)
      if (changed("mobilephone") && linkedRegno(doc) && !doc.erp?.loginPhone && !linkRefused(doc)) {
        // As the login sends it (`loginFor`): the stored value, trimmed.
        const previous = blank(doc.profile.mobilephone) ? "" : String(doc.profile.mobilephone).trim();
        if (previous) doc.erp = { ...doc.erp, loginPhone: previous };
      }
      doc.erp = { ...doc.erp, profileEdited: true, ...clearedFields(doc, body) };
      // Newly complete or new credentials: the ERP gets a fresh try on the next
      // visit — no leftover pull backoff, no stale refusal.
      if (newCredentials || (!wasComplete && isIdentityComplete({ ...doc.profile, ...body }))) {
        delete doc.erp.pullFailures;
        delete doc.erp.pullFailedAt;
        delete doc.erp.linkError;
        delete doc.erp.linkKey;
      } else if (retry) {
        // The applicant asked to retry the same регистр + утас (they say it is
        // right): lift the refusal so the next sync asks the ERP once more. An
        // ordinary profile save echoes both too, and must not re-send them.
        delete doc.erp.linkError;
        delete doc.erp.linkKey;
      }
      doc.profile = {
        ...doc.profile,
        ...body,
        countryname: await label("GetCountryDropDown", body.countryid),
        divisionname: await label("GetDivisionDropDown", body.divisionid, {
          countryid: body.countryid,
        }),
        districtname: await label("GetDistrictDropDown", body.districtid, {
          divisionid: body.divisionid,
        }),
        relativename: await label("GetRelativeDropDown", body.relativeid),
        relativename2: await label("GetRelativeDropDown", body.relativeid2),
      };
      return ok(doc.profile, true);
    }

    case "SaveAppPicture": {
      if (!upload) return fail("file not selected");
      // JPEG by construction: the picker re-encodes every photo as JPEG before
      // upload (`lib/resize-image.ts` `resizePhoto`).
      doc.picture = `data:image/jpeg;base64,${upload.data}`;
      return ok(true, true);
    }

    case "SaveAppCV": {
      if (!upload) return fail("file not selected");
      doc.cv = { filename: upload.name, filedata: upload.data };
      return ok(true, true);
    }

    case "deleteAppCV":
      doc.cv = null;
      return ok(true, true);

    case "SaveHrAppEducation": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      // The school is заавал: one from the list, or — not listed —
      // `universityid: 0` with its name typed into `universitynametext`.
      if (!(Number(body.universityid) > 0) && blank(body.universitynametext)) {
        return fail(SCHOOL_REQUIRED_MESSAGE);
      }
      return ok(upsert(doc.education, await labelRow("education", body, label)), true);
    }

    case "SaveAppForLanguage": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      // Without the language the row means nothing (the form requires it too).
      if (!(Number(body.forlanguageid) > 0)) return fail(LANGUAGE_REQUIRED_MESSAGE);
      return ok(upsert(doc.languages, await labelRow("languages", body, label)), true);
    }

    case "SaveAppSkillComp": {
      const rows = asRows(rawBody);
      // Each row names its program: one from the list, or — not listed —
      // `skillcompid: 0` with the name typed into `compnametext`. One row
      // without either refuses the whole array (nothing half-saved).
      if (rows.length === 0 || rows.some((row) => !(Number(row.skillcompid) > 0) && blank(row.compnametext))) {
        return fail(SKILL_REQUIRED_MESSAGE);
      }
      const saved: Row[] = [];
      for (const row of rows) saved.push(upsert(doc.skills, await labelRow("skills", row, label)));
      return ok(saved, true);
    }

    case "SaveAppExperience": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      // The form requires both. The job is a list id: there is no typed-job
      // column in the Postman body (only the business type has one).
      if (blank(body.orgname)) return fail(EXPERIENCE_ORG_REQUIRED_MESSAGE);
      if (!(Number(body.jobid) > 0)) return fail(EXPERIENCE_JOB_REQUIRED_MESSAGE);
      return ok(upsert(doc.experience, await labelRow("experience", body, label)), true);
    }

    case "SaveAppFamily": {
      const rows = asRows(rawBody);
      // Who the member is and their name, on every row; one row without them
      // refuses the whole array (nothing half-saved), as skills do.
      if (rows.length === 0 || rows.some((row) => !(Number(row.relativeid) > 0) || blank(row.firstname))) {
        return fail(FAMILY_REQUIRED_MESSAGE);
      }
      const saved: Row[] = [];
      for (const row of rows) saved.push(upsert(doc.family, await labelRow("family", row, label)));
      return ok(saved, true);
    }

    case "SaveInterestedJobItem": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      // The group is заавал (Postman: only `positionid` may be left empty).
      if (!(Number(body.posgroupid) > 0)) return fail(INTEREST_GROUP_REQUIRED_MESSAGE);
      // The same group + position twice is one request; an edit may keep its own.
      const entryid = Number(body.entryid);
      if (doc.interests.some((row) => Number(row.entryid) !== entryid && sameInterest(row, body))) {
        return fail(INTEREST_DUPLICATE_MESSAGE);
      }
      return ok(upsert(doc.interests, await labelRow("interests", body, label)), true);
    }

    case "SaveHrRecruitmentOrderApp": {
      const orderId = Number(body?.recruitmentorderid ?? 0);
      const order = await deps.jobOrder(orderId);
      if (!order) return fail("Ажлын байр олдсонгүй.");

      if (
        doc.applications.some((row) => Number(row.recruitmentorderid) === orderId) ||
        (doc.erp?.appliedOrderIds ?? []).includes(orderId)
      ) {
        return fail("Та энэ ажлын байранд аль хэдийн анкет илгээсэн байна.");
      }

      return ok(
        upsert(doc.applications, {
          entryid: 0,
          recruitmentorderid: orderId,
          posname: order.posname,
          companyname: order.companyname,
          locname: order.locname,
          salaryname: order.salarylevel ?? "",
          salrequest: body?.salrequest ?? null,
          availabledate: body?.poshiredate ?? "",
          recsourceid: body?.recsourceid ?? null,
          sourcename: await label("GetSourceDropDown", body?.recsourceid),
          statusid: 1,
          statusname: "Хүлээн авсан",
          senddate: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
        }),
        true,
      );
    }

    default:
      return null;
  }
}
