import { NextResponse } from "next/server";

import {
  type Account,
  accountFromToken,
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
  nextEntryId,
  saveDb,
} from "@/server/mock/store";
import {
  type HandlerDeps,
  type HandlerRequest,
  UNAUTHORIZED_MESSAGE,
  UPLOAD_ENDPOINTS,
  handleApplicantRequest,
} from "@/server/applicant/handlers";
import { readJson, readUpload } from "@/server/applicant/request-body";

/**
 * A stand-in for the recruitment backend.
 *
 * It answers on the same paths as the real service — `/api/applicant/*` — with
 * the same `{ rettype, retmsg, retdata }` envelope, so the client API layer
 * cannot tell the two apart. Set `NEXT_PUBLIC_API_URL` and every call goes to
 * the real origin instead; these routes simply stop being reached.
 *
 * The per-account endpoints are shared with `/api/me` (see
 * `src/server/applicant/handlers.ts`); this route adds the public reference
 * data, sign-up/sign-in (`SaveHrAppUser`, `auth/login`) and the password
 * change on top.
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

/** The ERP's answer to a регистр + утас (password) pair it does not accept. */
const MISMATCH_MESSAGE = "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!";

function unauthorized() {
  return fail(UNAUTHORIZED_MESSAGE, 401);
}

/** Reference data for the shared handler: the bundled mock lists. */
const mockDeps: HandlerDeps = {
  nextEntryId,
  label: (dropdown, key) => labelFor(dropdown, key),
  jobOrder: (entryID) => jobItem(entryID)?.hrrecruitmentorder[0] ?? null,
};

async function shared(request: HandlerRequest, account: Account) {
  const result = await handleApplicantRequest(request, account, mockDeps);
  if (!result) return fail(`Тодорхойгүй хүсэлт: ${request.endpoint}`, 404);
  return NextResponse.json(result.envelope, { status: result.status });
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
        salaryLevelID: url.searchParams.get("salaryLevelID") ?? "",
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

  return shared(
    { endpoint, method: "GET", query: url.searchParams, body: null },
    account,
  );
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

  /* --- sign in: auth/login {regNo, mobile} ----------------------------- */

  // As the live ERP answers it (verified 2026-09-22): the token under
  // `retdata`; an unknown регистр or a wrong phone (password) is one HTTP 401
  // with rettype -1. Only reads — never creates or changes an account.
  if (endpoint === "auth/login") {
    const body = (await readJson(request)) as { regNo?: unknown; mobile?: unknown } | null;
    const existing = findAccount(String(body?.regNo ?? "").trim().toUpperCase());
    if (!existing || existing.password !== String(body?.mobile ?? "").trim()) {
      return fail(MISMATCH_MESSAGE, 401, -1);
    }
    return ok(issueToken(existing));
  }

  /* --- sign up / sign in (one endpoint, Postman 01/02) ----------------- */

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
        return fail(MISMATCH_MESSAGE);
      }
      return ok(issueToken(existing));
    }

    if (!body?.lastname || !body?.firstname) {
      return fail(MISMATCH_MESSAGE);
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

  switch (endpoint) {
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

    default: {
      const upload = UPLOAD_ENDPOINTS.has(endpoint) ? await readUpload(request) : null;
      const body = UPLOAD_ENDPOINTS.has(endpoint) ? null : await readJson(request);
      return shared(
        { endpoint, method: "POST", query: url.searchParams, body, upload },
        account,
      );
    }
  }
}
