import { NextResponse } from "next/server";

import {
  type Account,
  type Row,
  accountFromToken,
  completion,
  createAccount,
  defaultCountry,
  dropdownRows,
  dropdowns,
  filterData,
  findAccount,
  issueToken,
  jobItem,
  jobList,
  labelFor,
  removeRow,
  saveDb,
  upsert,
} from "@/server/mock/store";

/**
 * A stand-in for the recruitment backend.
 *
 * It answers on the same paths as the real service — `/api/applicant/*` — with
 * the same `{ rettype, retmsg, retdata }` envelope, so the client API layer
 * cannot tell the two apart. Set `NEXT_PUBLIC_API_URL` and every call goes to
 * the real origin instead; these routes simply stop being reached.
 *
 * State is in memory (see `src/server/mock/store.ts`), and in development it
 * is mirrored to `.mock-data/db.json` so a dev-server restart does not sign
 * everyone out. In production it is memory only.
 */

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/applicant/[...path]">;

function ok(retdata: unknown, affectedrows = Array.isArray(retdata) ? retdata.length : 1) {
  return NextResponse.json({
    totalrow: 0,
    affectedrows,
    retdata,
    rettype: 0,
    depfilter: null,
    retparams: null,
    retmsg: "",
    traceno: 0,
  });
}

function fail(retmsg: string, status = 200, rettype = 1) {
  return NextResponse.json(
    {
      totalrow: 0,
      affectedrows: 0,
      retdata: null,
      rettype,
      depfilter: null,
      retparams: null,
      retmsg,
      traceno: 0,
    },
    { status },
  );
}

function unauthorized() {
  return fail("Нэвтрэх шаардлагатай.", 401);
}

function requireAccount(request: Request): Account | null {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  return accountFromToken(token);
}

function num(value: string | null, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Dropdowns share one handler: the parent id the list hangs off, `search`,
 * `ids` and `lfr`, all applied together by `dropdownRows`.
 */
function dropdown(name: string, url: URL) {
  return ok(dropdownRows(name, url.searchParams));
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readUpload(request: Request): Promise<{ name: string; data: string } | null> {
  try {
    const form = await request.formData();
    for (const value of form.values()) {
      if (value instanceof File && value.size > 0) {
        const buffer = Buffer.from(await value.arrayBuffer());
        return { name: value.name, data: buffer.toString("base64") };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/* ---------------------------------------------------------------------- */

export async function GET(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const endpoint = path.join("/");
  const url = new URL(request.url);

  /* --- public ---------------------------------------------------------- */

  if (endpoint in dropdowns) return dropdown(endpoint, url);

  if (endpoint === "getCountryID") return ok([defaultCountry]);

  if (endpoint === "getRecruitmentOrderList") {
    return ok(
      jobList({
        jobName: url.searchParams.get("jobName") ?? "",
        locationid: num(url.searchParams.get("locationid")),
      }),
    );
  }

  if (endpoint === "getDropDownData") return ok(filterData, 5);

  if (endpoint === "getRecruitmentOrderItem") {
    const item = jobItem(num(url.searchParams.get("entryID")));
    return item ? ok(item) : fail("Ажлын байр олдсонгүй.");
  }

  /* --- authenticated --------------------------------------------------- */

  const account = requireAccount(request);
  if (!account) return unauthorized();

  switch (endpoint) {
    case "get":
      return ok({
        ...account.profile,
        picturedata: account.picture,
        filename: account.cv?.filename ?? null,
        filedata: account.cv?.filedata ?? null,
        ...completion(account),
      });

    case "GetHrAppEducationData":
      return ok({
        hrappedulist: account.education,
        hrapplanglist: account.languages,
        hrappquallist: account.qualifications,
        hrappcomplist: account.skills,
      });

    case "GetHrAppExperienceData":
      return ok({
        hrappexplist: account.experience,
        hrappprojectlist: account.projects,
        hrappinternlist: account.internships,
      });

    case "GetHrAppFamilyData":
      return ok({
        hrappfamilylist: account.family,
        hrapprelativelist: account.relatives,
      });

    case "GetHrAppEducation":
      return ok(one(account.education, num(url.searchParams.get("entryid"))));
    case "GetAppForLanguage":
      return ok(one(account.languages, num(url.searchParams.get("entryid"))));
    case "GetAppSkillComp":
      return ok(one(account.skills, num(url.searchParams.get("entryid"))));
    case "GetAppExperience":
      return ok(one(account.experience, num(url.searchParams.get("entryid"))));
    case "GetAppFamily":
      return ok(one(account.family, num(url.searchParams.get("entryid"))));

    case "getInterestedJobsList":
      return ok(account.interests);

    case "getRecruitmenRequestList":
      return ok(account.applications);

    default:
      return fail(`Тодорхойгүй хүсэлт: ${endpoint}`, 404);
  }
}

function one(rows: Row[], entryid: number): Row | null {
  return rows.find((row) => Number(row.entryid) === entryid) ?? null;
}

/* ---------------------------------------------------------------------- */

/**
 * Every mutating endpoint is a POST, and the handler below edits account
 * objects in place, so this wrapper is the one place that sees all of them —
 * a hook inside `createAccount` would miss the rest.
 */
export async function POST(request: Request, ctx: Ctx) {
  const response = await post(request, ctx);
  saveDb();
  return response;
}

async function post(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const endpoint = path.join("/");
  const url = new URL(request.url);

  /* --- sign up / sign in (one endpoint) -------------------------------- */

  if (endpoint === "SaveHrAppUser") {
    const body = (await readJson(request)) as Record<string, string> | null;
    const regno = (body?.regno ?? "").trim().toUpperCase();
    const mobilephone = (body?.mobilephone ?? "").trim();

    if (!regno || !mobilephone) {
      return fail("Регистрийн дугаар болон утасны дугаараа оруулна уу.");
    }

    const existing = findAccount(regno);
    if (existing) {
      if (existing.password !== mobilephone) {
        return fail("Бүртгэгдсэн регистрийн дугаар болон утасны дугаар таарахгүй байна.");
      }
      return ok(issueToken(existing));
    }

    if (!body?.lastname || !body?.firstname) {
      return fail("Бүртгэгдсэн регистрийн дугаар болон утасны дугаар таарахгүй байна.");
    }

    const account = createAccount({
      regno,
      lastname: body.lastname,
      firstname: body.firstname,
      email: body.email ?? "",
      mobilephone,
    });
    return ok(issueToken(account));
  }

  /* --- authenticated --------------------------------------------------- */

  const account = requireAccount(request);
  if (!account) return unauthorized();

  const entryid = num(
    url.searchParams.get("entryid") ??
      url.searchParams.get("ENTRYID") ??
      url.searchParams.get("entryID"),
  );

  switch (endpoint) {
    case "SaveHrApplicant": {
      const body = (await readJson(request)) as Row | null;
      if (!body) return fail("Мэдээлэл дутуу байна.");
      account.profile = {
        ...account.profile,
        ...body,
        countryname: labelFor("GetCountryDropDown", body.countryid),
        divisionname: labelFor("GetDivisionDropDown", body.divisionid),
        districtname: labelFor("GetDistrictDropDown", body.districtid),
        relativename: labelFor("GetRelativeDropDown", body.relativeid),
        relativename2: labelFor("GetRelativeDropDown", body.relativeid2),
      };
      return ok(account.profile);
    }

    case "changeUserInfo": {
      const body = (await readJson(request)) as Record<string, string> | null;
      if (body?.type === "PASSWORD") {
        if (account.password !== body.oldpassword) {
          return fail("Одоогийн нууц үг буруу байна.");
        }
        if (!body.newpassword || body.newpassword.length < 6) {
          return fail("Шинэ нууц үг дор хаяж 6 тэмдэгттэй байна.");
        }
        account.password = body.newpassword;
        account.profile.mobilephone = account.profile.mobilephone ?? "";
      } else if (body?.type === "PHONE") {
        account.profile.mobilephone = body.phonenumber ?? "";
      } else if (body?.type === "EMAIL") {
        account.profile.email2 = body.email ?? "";
      }
      return ok(true);
    }

    case "SaveAppPicture": {
      const file = await readUpload(request);
      if (!file) return fail("file not selected");
      account.picture = `data:image/jpeg;base64,${file.data}`;
      return ok(true);
    }

    case "SaveAppCV": {
      const file = await readUpload(request);
      if (!file) return fail("file not selected");
      account.cv = { filename: file.name, filedata: file.data };
      return ok(true);
    }

    case "deleteAppCV":
      account.cv = null;
      return ok(true);

    case "SaveHrAppEducation": {
      const body = (await readJson(request)) as Row | null;
      if (!body) return fail("Мэдээлэл дутуу байна.");
      return ok(
        upsert(account.education, {
          ...body,
          universityname: labelFor("GetUniversityDropDown", body.universityid),
          professionname: labelFor("GetProfessionDropDown", body.professionid),
          educationlevelname: labelFor("get_educationlevel_dropdown", body.educationlevelid),
        }),
      );
    }

    case "SaveAppForLanguage": {
      const body = (await readJson(request)) as Row | null;
      if (!body) return fail("Мэдээлэл дутуу байна.");
      return ok(
        upsert(account.languages, {
          ...body,
          forlanguagename: labelFor("GetForLanguageDropDown", body.forlanguageid),
        }),
      );
    }

    case "SaveAppSkillComp": {
      const body = (await readJson(request)) as Row[] | Row | null;
      const rows = Array.isArray(body) ? body : body ? [body] : [];
      const saved = rows.map((row) =>
        upsert(account.skills, {
          ...row,
          skillcompname: labelFor("GetSkillCompDropDown", row.skillcompid),
          levelname: labelFor("GetSkillCompLevelDropDown", row.levelid),
        }),
      );
      return ok(saved);
    }

    case "SaveAppExperience": {
      const body = (await readJson(request)) as Row | null;
      if (!body) return fail("Мэдээлэл дутуу байна.");
      return ok(
        upsert(account.experience, {
          ...body,
          jobname: labelFor("GetJobDropDown", body.jobid),
          businesstypename: labelFor("GetBusinessTypeDropDown", body.businesstypeid),
        }),
      );
    }

    case "SaveAppFamily": {
      const body = (await readJson(request)) as Row[] | Row | null;
      const rows = Array.isArray(body) ? body : body ? [body] : [];
      const saved = rows.map((row) =>
        upsert(account.family, {
          ...row,
          relativename: labelFor("GetRelativeDropDown", row.relativeid),
        }),
      );
      return ok(saved);
    }

    case "SaveInterestedJobItem": {
      const body = (await readJson(request)) as Row | null;
      if (!body) return fail("Мэдээлэл дутуу байна.");
      const position = dropdowns.getPositionsDropdown.find(
        (row) => String(row.key) === String(body.positionid),
      );
      return ok(
        upsert(account.interests, {
          ...body,
          posgroupname: labelFor("getPosGroupDropdown", body.posgroupid),
          positionname: position ? String(position.text) : "",
        }),
      );
    }

    case "SaveHrRecruitmentOrderApp": {
      const body = (await readJson(request)) as Row | null;
      const orderId = Number(body?.recruitmentorderid ?? 0);
      const detail = jobItem(orderId);
      if (!detail) return fail("Ажлын байр олдсонгүй.");

      if (account.applications.some((row) => Number(row.recruitmentorderid) === orderId)) {
        return fail("Та энэ ажлын байранд аль хэдийн анкет илгээсэн байна.");
      }

      const order = detail.hrrecruitmentorder[0];
      return ok(
        upsert(account.applications, {
          entryid: 0,
          recruitmentorderid: orderId,
          posname: order.posname,
          companyname: order.companyname,
          locname: order.locname,
          salaryname: order.salarylevel ?? "",
          salrequest: body?.salrequest ?? null,
          availabledate: body?.poshiredate ?? "",
          recsourceid: body?.recsourceid ?? null,
          sourcename: labelFor("GetSourceDropDown", body?.recsourceid),
          statusid: 1,
          statusname: "Хүлээн авсан",
          senddate: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
        }),
      );
    }

    case "DeleteHrAppEducation":
      return removeRow(account.education, entryid) ? ok(true) : fail("Мөр олдсонгүй.");
    case "DeleteAppForLanguage":
      return removeRow(account.languages, entryid) ? ok(true) : fail("Мөр олдсонгүй.");
    case "DeleteAppSkillComp":
      return removeRow(account.skills, entryid) ? ok(true) : fail("Мөр олдсонгүй.");
    case "DeleteAppExperience":
      return removeRow(account.experience, entryid) ? ok(true) : fail("Мөр олдсонгүй.");
    case "DeleteAppFamily":
      return removeRow(account.family, entryid) ? ok(true) : fail("Мөр олдсонгүй.");
    case "deleteInterestedJob":
      return removeRow(account.interests, entryid) ? ok(true) : fail("Мөр олдсонгүй.");
    case "DeleteOrderApp":
      return removeRow(account.applications, entryid) ? ok(true) : fail("Хүсэлт олдсонгүй.");

    default:
      return fail(`Тодорхойгүй хүсэлт: ${endpoint}`, 404);
  }
}
