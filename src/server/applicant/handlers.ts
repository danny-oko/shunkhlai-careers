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
  cv: { filename: string; filedata: string } | null;
  picture: string | null;
  /** ERP push bookkeeping (`/api/me` only): the hash of the CV last sent. */
  /** ERP sync state; profileEdited = the applicant saved their profile here. */
  erp?: { cvHash?: string; profileEdited?: boolean };
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

/** `entryid: 0` inserts, anything else updates in place. */
export function upsertRow(rows: Row[], entry: Row, nextId: () => number): Row {
  const entryid = Number(entry.entryid ?? 0);
  if (entryid > 0) {
    const index = rows.findIndex((row) => Number(row.entryid) === entryid);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...entry };
      return rows[index];
    }
  }
  const created = { ...entry, entryid: nextId() };
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
      doc.erp = { ...doc.erp, profileEdited: true };
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
      return ok(
        upsert(doc.education, {
          ...body,
          universityname: await label("GetUniversityDropDown", body.universityid, {
            countryid: body.countryid,
          }),
          professionname: await label("GetProfessionDropDown", body.professionid),
          educationlevelname: await label("get_educationlevel_dropdown", body.educationlevelid),
        }),
        true,
      );
    }

    case "SaveAppForLanguage": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      return ok(
        upsert(doc.languages, {
          ...body,
          forlanguagename: await label("GetForLanguageDropDown", body.forlanguageid),
        }),
        true,
      );
    }

    case "SaveAppSkillComp": {
      const saved: Row[] = [];
      for (const row of asRows(rawBody)) {
        saved.push(
          upsert(doc.skills, {
            ...row,
            skillcompname: await label("GetSkillCompDropDown", row.skillcompid),
            levelname: await label("GetSkillCompLevelDropDown", row.levelid, {
              skillcompid: row.skillcompid,
            }),
          }),
        );
      }
      return ok(saved, true);
    }

    case "SaveAppExperience": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      return ok(
        upsert(doc.experience, {
          ...body,
          jobname: await label("GetJobDropDown", body.jobid),
          businesstypename: await label("GetBusinessTypeDropDown", body.businesstypeid),
        }),
        true,
      );
    }

    case "SaveAppFamily": {
      const saved: Row[] = [];
      for (const row of asRows(rawBody)) {
        saved.push(
          upsert(doc.family, {
            ...row,
            relativename: await label("GetRelativeDropDown", row.relativeid),
          }),
        );
      }
      return ok(saved, true);
    }

    case "SaveInterestedJobItem": {
      if (!body) return fail("Мэдээлэл дутуу байна.");
      return ok(
        upsert(doc.interests, {
          ...body,
          posgroupname: await label("getPosGroupDropdown", body.posgroupid),
          positionname: await label("getPositionsDropdown", body.positionid),
        }),
        true,
      );
    }

    case "SaveHrRecruitmentOrderApp": {
      const orderId = Number(body?.recruitmentorderid ?? 0);
      const order = await deps.jobOrder(orderId);
      if (!order) return fail("Ажлын байр олдсонгүй.");

      if (doc.applications.some((row) => Number(row.recruitmentorderid) === orderId)) {
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
