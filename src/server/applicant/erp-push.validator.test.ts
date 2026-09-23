import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ATTEMPTS, createPushBatch, isDue, pushApplication } from "./erp-push";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * Validator suite for the ERP push (kept separate from the implementor's
 * erp-push.test.ts). A stateful fake ERP sits behind global fetch.
 */

const REGNO = "УБ99010101";
const PHONE = "99112233";
const TOKEN = "tok-SECRET-abc123";

type Call = { method: string; endpoint: string; query: string; body: unknown; auth: string | null };

type Fake = {
  calls: Call[];
  registered: boolean;
  loginFailsTimes: number;
  record: Row;
  requestList: Row[];
  applyError: string | null;
  down: boolean;
  hang: boolean;
  nextEntryId: number;
};

let erp: Fake;

function envelope(retdata: unknown, rettype = 0, retmsg = "") {
  return new Response(JSON.stringify({ rettype, retmsg, retdata }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function readBody(init?: RequestInit): Promise<unknown> {
  const b = init?.body;
  if (b === undefined || b === null) return null;
  if (typeof b === "string") return JSON.parse(b);
  if (b instanceof FormData) {
    const f = b.get("file") as File | null;
    return f ? { filename: f.name, bytes: Buffer.from(await f.arrayBuffer()).toString("base64") } : null;
  }
  return b;
}

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const endpoint = url.pathname.replace(/^\/api\/applicant\//, "");
  const headers = new Headers(init?.headers);
  erp.calls.push({
    method: init?.method ?? "GET",
    endpoint,
    query: url.search,
    body: await readBody(init),
    auth: headers.get("authorization"),
  });

  if (erp.hang) {
    return new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) return reject(signal.reason);
      signal?.addEventListener("abort", () => reject(signal.reason));
    });
  }
  if (erp.down) throw new TypeError("fetch failed");

  const authed = headers.get("authorization") === `Bearer ${TOKEN}`;
  switch (endpoint) {
    case "auth/login": {
      const body = (await readBody(init)) as { regNo: string; mobile: string };
      if (!erp.registered || erp.loginFailsTimes > 0 || body.regNo !== REGNO || body.mobile !== PHONE) {
        erp.loginFailsTimes = Math.max(0, erp.loginFailsTimes - 1);
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
      }
      return new Response(JSON.stringify({ access_token: TOKEN }), { status: 200 });
    }
    case "SaveHrAppUser": {
      // Live (Postman 01/02): a new регистр is created; an existing one only
      // logs in on the matching phone, otherwise "…зөрж байна!" and no change.
      const body = (await readBody(init)) as Row;
      if (erp.registered && body.regno === REGNO && body.mobilephone !== PHONE) {
        return envelope(null, 1, "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!");
      }
      erp.registered = true;
      return envelope({ access_token: TOKEN });
    }
  }
  if (!authed) return envelope(null, 1, "Нэвтрэх шаардлагатай.");
  switch (endpoint) {
    case "get":
      return envelope({ applicantdata: [erp.record] });
    case "SaveHrApplicant":
    case "SaveAppCV":
    case "DeleteOrderApp":
      return envelope(true);
    case "SaveHrRecruitmentOrderApp": {
      if (erp.applyError) return envelope(null, 1, erp.applyError);
      const body = (await readBody(init)) as Row;
      erp.requestList.push({ entryid: erp.nextEntryId++, recruitmentorderid: body.recruitmentorderid });
      return envelope(true);
    }
    case "getRecruitmenRequestList":
      return envelope(erp.requestList);
    default:
      return envelope(null, 1, `unknown ${endpoint}`);
  }
});

function doc(profile: Row = {}, over: Partial<ApplicantDoc> = {}): ApplicantDoc {
  return {
    profile: { lastname: "Дорж", firstname: "Бат", regno: REGNO, mobilephone: PHONE, email2: "bat@x.mn", ...profile },
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
    ...over,
  };
}

const app: Row = {
  entryid: 1001,
  recruitmentorderid: 786,
  posname: "Багаж хариуцсан ажилтан",
  locname: "Төв оффис",
  salrequest: 3000000,
  availabledate: "2026.10.01",
  recsourceid: 2,
};

const identity = { firstname: "Бат", lastname: "Дорж", email: "bat@x.mn" };
const CV = { filename: "cv.pdf", data: Buffer.from("PDF-BYTES").toString("base64") };

function deps(cv: typeof CV | null = null) {
  return { identity, loadCv: vi.fn(async () => cv), batch: createPushBatch() };
}

/** AbortSignal.timeout driven by (fakeable) setTimeout. */
function fakeTimeoutSignal(ms: number): AbortSignal {
  const c = new AbortController();
  const fire = () => c.abort(new DOMException("timed out", "TimeoutError"));
  setTimeout(fire, ms);
  return c.signal;
}

const endpoints = () => erp.calls.map((c) => c.endpoint);

let logs: string[];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
  erp = {
    calls: [],
    registered: true,
    loginFailsTimes: 0,
    record: {
      lastname: "Дорж",
      firstname: "Бат",
      regno: REGNO,
      mobilephone: PHONE,
      addr2: "ERP хаяг",
      contactname: "ERP contact",
      custom1: "ERP custom",
      isa: true,
      districtid: 7,
    },
    requestList: [{ entryid: 5, recruitmentorderid: 111 }],
    applyError: null,
    down: false,
    hang: false,
    nextEntryId: 900,
  };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  logs = [];
  const capture = (...args: unknown[]) => {
    logs.push(
      args
        .map((a) => (a instanceof Error ? `${a.name} ${a.message} ${a.stack}` : typeof a === "string" ? a : JSON.stringify(a)))
        .join(" "),
    );
  };
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation(capture);
  }
});

afterEach(() => {
  // Nothing any path logs may contain the credentials or the token.
  const all = logs.join("\n");
  expect(all).not.toContain(REGNO);
  expect(all).not.toContain(PHONE);
  expect(all).not.toContain(TOKEN);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("pushApplication (validator)", () => {
  it("happy path: exact call order, bearer on every authed call, entry id from the list", async () => {
    const r = await pushApplication(doc({}, { cv: { filename: "cv.pdf", filedata: "" } }), app, deps(CV));
    expect(r).toMatchObject({ status: "sent", erpEntryId: 900 });
    expect(r.cvHash).toBe(createHash("sha256").update(CV.data).digest("hex"));
    expect(endpoints()).toEqual([
      "auth/login",
      "get",
      "SaveHrApplicant",
      "SaveAppCV",
      "SaveHrRecruitmentOrderApp",
      "getRecruitmenRequestList",
    ]);
    expect(erp.calls[0].body).toEqual({ regNo: REGNO, mobile: PHONE });
    for (const c of erp.calls.slice(1)) expect(c.auth).toBe(`Bearer ${TOKEN}`);
    const apply = erp.calls.find((c) => c.endpoint === "SaveHrRecruitmentOrderApp")!.body as Row;
    expect(apply).toMatchObject({ recruitmentorderid: 786, salrequest: 3000000, poshiredate: "2026.10.01", recsourceid: 2 });
    expect(erp.calls.find((c) => c.endpoint === "SaveAppCV")!.body).toEqual({ filename: "cv.pdf", bytes: CV.data });
  });

  // Login first; SaveHrAppUser only after a 401, once per batch (Postman 01/02).
  it("login 401 → one SaveHrAppUser → its token carries the push", async () => {
    erp.loginFailsTimes = 99;
    const r = await pushApplication(doc(), app, deps());
    expect(r).toMatchObject({ status: "sent" });
    expect(endpoints().slice(0, 2)).toEqual(["auth/login", "SaveHrAppUser"]);
    expect(endpoints().filter((e) => e === "SaveHrAppUser")).toHaveLength(1);
  });

  it("existing регистр, other phone → erp_link_mismatch, one SaveHrAppUser per batch, nothing else sent", async () => {
    const d = deps();
    const wrong = doc({ mobilephone: "88000000" });
    expect(await pushApplication(wrong, app, d)).toMatchObject({ status: "failed", error: "erp_link_mismatch" });
    expect(await pushApplication(wrong, { ...app, recruitmentorderid: 787 }, d)).toMatchObject({ status: "failed" });
    expect(endpoints()).toEqual(["auth/login", "SaveHrAppUser"]);
  });

  it("login unreachable (not a 401) → never registers", async () => {
    erp.down = true;
    expect(await pushApplication(doc(), app, deps())).toMatchObject({ status: "failed", error: "erp_login_failed" });
    expect(endpoints()).toEqual(["auth/login"]);
  });

  it("missing regno or phone → profile_incomplete, no ERP call", async () => {
    for (const p of [{ regno: "" }, { mobilephone: "  " }, { regno: null }]) {
      expect(await pushApplication(doc(p), app, deps())).toMatchObject({ status: "failed", error: "profile_incomplete" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("SaveHrApplicant keeps every ERP field D1 has empty; non-empty D1 values win", async () => {
    await pushApplication(
      doc({ addr2: "", contactname: null, custom1: "   ", isa: false, districtid: null, contactphone: "88001122" }),
      app,
      deps(),
    );
    const sent = erp.calls.find((c) => c.endpoint === "SaveHrApplicant")!.body as Row;
    expect(sent).toMatchObject({
      addr2: "ERP хаяг",
      contactname: "ERP contact",
      custom1: "ERP custom",
      isa: true,
      districtid: 7,
      regno: REGNO,
      mobilephone: PHONE,
      contactphone: "88001122",
    });
    for (const k of Object.keys(erp.record)) {
      expect(sent[k], `field ${k} must not be blanked`).not.toBe("");
      expect(sent[k], `field ${k} must not be dropped`).not.toBeUndefined();
    }
  });

  it("CV is sent once; the same CV (same hash) is not re-sent", async () => {
    const d = doc({}, { cv: { filename: "cv.pdf", filedata: "" } });
    const first = await pushApplication(d, app, deps(CV));
    expect(endpoints().filter((e) => e === "SaveAppCV")).toHaveLength(1);
    d.erp = { cvHash: first.cvHash };
    erp.calls = [];
    const second = await pushApplication(d, { ...app, recruitmentorderid: 787 }, deps(CV));
    expect(second.status).toBe("sent");
    expect(endpoints()).not.toContain("SaveAppCV");
  });

  it("duplicate application from the ERP counts as sent (id looked up)", async () => {
    erp.applyError = "Та энэ ажлын байранд аль хэдийн анкет илгээсэн байна.";
    erp.requestList.push({ entryid: 777, recruitmentorderid: 786 });
    expect(await pushApplication(doc(), app, deps())).toMatchObject({ status: "sent", erpEntryId: 777 });
  });

  it("ERP down → failed, never throws", async () => {
    erp.down = true;
    expect((await pushApplication(doc(), app, deps())).status).toBe("failed");
  });

  it("ERP hangs → each fetch aborts after ~10s → failed (and not before)", async () => {
    vi.useFakeTimers();
    // Cover either timeout style: setTimeout+AbortController or AbortSignal.timeout.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(fakeTimeoutSignal);
    erp.hang = true;
    let settled = false;
    const p = pushApplication(doc(), app, deps()).finally(() => (settled = true));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled).toBe(false);
    expect(erp.calls).toHaveLength(1); // still waiting on the first login
    await vi.advanceTimersByTimeAsync(2_000); // the login gave up at ~10s
    expect(await p).toMatchObject({ status: "failed", error: "erp_login_failed" });
    expect(erp.calls).toHaveLength(1);
  });

  it("NEXT_PUBLIC_API_URL unset → skipped, fetch never called", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(await pushApplication(doc(), app, deps(CV))).toEqual({ status: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("one batch = one login and one profile sync for several applications", async () => {
    const d = deps();
    await pushApplication(doc(), app, d);
    await pushApplication(doc(), { ...app, recruitmentorderid: 787 }, d);
    expect(endpoints().filter((e) => e === "auth/login")).toHaveLength(1);
    expect(endpoints().filter((e) => e === "SaveHrApplicant")).toHaveLength(1);
    expect(endpoints().filter((e) => e === "SaveHrRecruitmentOrderApp")).toHaveLength(2);
  });

  it("never calls a delete endpoint while pushing", async () => {
    erp.registered = false;
    await pushApplication(doc({}, { cv: { filename: "cv.pdf", filedata: "" } }), app, deps(CV));
    expect(endpoints().filter((e) => /delete/i.test(e))).toEqual([]);
  });
});

describe("isDue cap (validator)", () => {
  it("stops at MAX_ATTEMPTS = 5", () => {
    const row = (attempts: number) => ({
      erp: { status: "failed", attempts, lastAttemptAt: new Date(Date.now() - 86_400_000).toISOString() },
    });
    expect(MAX_ATTEMPTS).toBe(5);
    expect(isDue(row(4))).toBe(true);
    expect(isDue(row(5))).toBe(false);
  });
});
