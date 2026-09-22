import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two-way ERP sync through /api/me (implementor suite): a real in-memory
 * SQLite behind drizzle, and a stateful fake ERP behind global fetch.
 */

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDb;
};

const state = vi.hoisted(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
  return {
    sqlite: null as null | SqliteDbLike,
    userId: "u1" as string | null,
    after: [] as Array<() => unknown>,
  };
  type SqliteDbLike = {
    exec(sql: string): void;
    prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (task: unknown) => {
      state.after.push(typeof task === "function" ? (task as () => unknown) : () => task);
    },
  };
});
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: state.userId }),
  currentUser: async () =>
    state.userId
      ? {
          id: state.userId,
          firstName: "Бат",
          lastName: "Дорж",
          primaryEmailAddress: { emailAddress: "bat@example.mn" },
          emailAddresses: [{ emailAddress: "bat@example.mn" }],
        }
      : null,
}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { drizzle } = await import("drizzle-orm/sqlite-proxy");
  const db = drizzle(
    async (sql, params, method) => {
      const stmt = state.sqlite!.prepare(sql);
      const rows = (stmt.all(...params) as Record<string, unknown>[]).map((r) => Object.values(r));
      return { rows: method === "get" ? (rows[0] ?? []) : rows };
    },
    { schema },
  );
  return { ...schema, schema, getDb: () => db };
});

import { GET, POST } from "./[...path]/route";

/* --- fake ERP ------------------------------------------------------------- */

const REGNO = "УБ99010101";
const PHONE = "99112233";
const TOKEN = "tok-SYNC-SECRET";
const CV_B64 = Buffer.from("ERP-CV").toString("base64");

type Row = Record<string, unknown>;
type Call = { endpoint: string; query: string; body: unknown };

let erp: {
  calls: Call[];
  down: boolean;
  record: Row;
  lists: Record<string, Row[]>;
  interests: Row[];
  requests: Row[];
  nextId: number;
};

const LIST_OF: Record<string, [string, string]> = {
  SaveHrAppEducation: ["GetHrAppEducationData", "hrappedulist"],
  SaveAppForLanguage: ["GetHrAppEducationData", "hrapplanglist"],
  SaveAppSkillComp: ["GetHrAppEducationData", "hrappcomplist"],
  SaveAppExperience: ["GetHrAppExperienceData", "hrappexplist"],
  SaveAppFamily: ["GetHrAppFamilyData", "hrappfamilylist"],
  DeleteHrAppEducation: ["GetHrAppEducationData", "hrappedulist"],
  DeleteAppExperience: ["GetHrAppExperienceData", "hrappexplist"],
  DeleteAppFamily: ["GetHrAppFamilyData", "hrappfamilylist"],
};

function bundle(source: string): Row {
  const keys = Object.entries(LIST_OF)
    .filter(([, [s]]) => s === source)
    .map(([, [, k]]) => k);
  const base: Row = {};
  for (const [key, rows] of Object.entries(erp.lists)) if (keys.includes(key) || key.startsWith("hrapp")) base[key] = rows;
  return Object.fromEntries(Object.entries(base).filter(([k]) => keys.includes(k) || source === "*"));
}

const env = (retdata: unknown, rettype = 0, retmsg = "") =>
  new Response(JSON.stringify({ rettype, retmsg, retdata }));

async function fakeErp(input: string | URL, init?: RequestInit) {
  const url = new URL(String(input));
  const endpoint = url.pathname.replace(/^\/api\/applicant\//, "");
  const raw = init?.body;
  const body = typeof raw === "string" ? JSON.parse(raw) : raw instanceof FormData ? "form" : null;
  erp.calls.push({ endpoint, query: url.search, body });
  if (erp.down) throw new TypeError("fetch failed");
  const q = url.searchParams;

  switch (endpoint) {
    case "auth/login":
      return new Response(JSON.stringify({ access_token: TOKEN }));
    case "get":
      return env({ applicantdata: [erp.record], recruitmentorders: [{ recruitmentorderid: 786 }], maritalstatus: [] });
    case "GetHrAppEducationData":
    case "GetHrAppExperienceData":
    case "GetHrAppFamilyData":
      return env(bundle(endpoint));
    case "getInterestedJobsList":
      return env(erp.interests);
    case "getRecruitmenRequestList":
      return env(erp.requests);
    case "SaveHrApplicant":
      erp.record = { ...erp.record, ...(body as Row) };
      return env(true);
    case "SaveAppCV":
    case "SaveAppPicture":
    case "deleteAppCV":
      return env(true);
    case "SaveHrRecruitmentOrderApp":
      erp.requests.push({ entryid: erp.nextId++, posname: "new" });
      return env(true);
    case "DeleteOrderApp": {
      const id = Number(q.get("entryID"));
      erp.requests = erp.requests.filter((r) => r.entryid !== id);
      return env(true);
    }
    case "deleteInterestedJob": {
      const id = Number(q.get("entryid"));
      erp.interests = erp.interests.filter((r) => r.entryid !== id);
      return env(true);
    }
  }
  if (LIST_OF[endpoint]) {
    const [, key] = LIST_OF[endpoint];
    const rows = (erp.lists[key] ??= []);
    if (endpoint.startsWith("Delete")) {
      const id = Number(q.get("entryid") ?? q.get("ENTRYID"));
      if (!rows.some((r) => r.entryid === id)) return env(null, 1, "Мөр олдсонгүй.");
      erp.lists[key] = rows.filter((r) => r.entryid !== id);
      return env(true);
    }
    for (const item of Array.isArray(body) ? body : [body]) {
      const row = item as Row;
      const id = Number(row.entryid);
      const index = rows.findIndex((r) => r.entryid === id);
      if (id > 0 && index >= 0) rows[index] = { ...rows[index], ...row };
      else rows.push({ ...row, entryid: erp.nextId++, appid: 1, createddate: "x" });
    }
    return env(true);
  }
  return env(null, 1, `unknown ${endpoint}`);
}

/* --- helpers --------------------------------------------------------------- */

function freshDb() {
  state.sqlite = new DatabaseSync(":memory:");
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) state.sqlite!.exec(stmt);
    }
  }
}

type Env = { rettype: number; retmsg: string; retdata: unknown };
const ctx = (endpoint: string) => ({ params: Promise.resolve({ path: endpoint.split("/") }) });

async function get(endpoint: string, query = "") {
  const res = await GET(new Request(`http://x/api/me/${endpoint}${query}`), ctx(endpoint) as never);
  return (await res.json()) as Env;
}

async function post(endpoint: string, body?: unknown, query = "") {
  const init: RequestInit = { method: "POST" };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const res = await POST(new Request(`http://x/api/me/${endpoint}${query}`, init), ctx(endpoint) as never);
  return (await res.json()) as Env;
}

async function runAfter() {
  while (state.after.length) await state.after.shift()!();
}

const doc = () => {
  const [row] = state.sqlite!.prepare("select data_json from applicant_account").all() as Array<{ data_json: string }>;
  return JSON.parse(row.data_json) as Row & { erp?: Row; education: Row[]; interests: Row[]; applications: Row[] };
};

/** An account that already has the регистр + phone (a pre-sync D1 doc). */
async function seedAccount() {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  await post("SaveHrApplicant", { regno: REGNO, mobilephone: PHONE, firstname: "Бат" });
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
  state.after = [];
}

let logs: string[];

beforeEach(() => {
  freshDb();
  state.userId = "u1";
  state.after = [];
  erp = {
    calls: [],
    down: false,
    record: {
      regno: REGNO,
      mobilephone: PHONE,
      lastname: "Дорж",
      firstname: "Бат",
      addr2: "ERP хаяг",
      filename: "cv.pdf",
      filedata: CV_B64,
      picturedata: "UElD",
      totalper: 80,
      appid: 5,
      createddate: "2026-01-01",
    },
    lists: {
      hrappedulist: [{ entryid: 11, universitynametext: "МУИС", appid: 5, createdby: "x", tstamp: 1 }],
      hrapplanglist: [{ entryid: 12, forlanguageid: 15 }],
      hrappquallist: [],
      hrappcomplist: [],
      hrappexplist: [{ entryid: 13, orgname: "Шунхлай" }],
      hrappprojectlist: [],
      hrappinternlist: [],
      hrappfamilylist: [{ entryid: 14, firstname: "Ээж" }],
      hrapprelativelist: [],
    },
    interests: [{ entryid: 15, posgroupid: 45, posgroupname: "Агуулах" }],
    requests: [{ entryid: 16, posname: "Нягтлан", statusname: "Хүлээн авсан", finalresult: null }],
    nextId: 500,
  };
  vi.stubGlobal("fetch", vi.fn(fakeErp));
  logs = [];
  const capture = (...a: unknown[]) => logs.push(a.map(String).join(" "));
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation(capture);
  }
});

afterEach(() => {
  const all = logs.join("\n");
  expect(all).not.toContain(REGNO);
  expect(all).not.toContain(PHONE);
  expect(all).not.toContain(TOKEN);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* --- tests ----------------------------------------------------------------- */

describe("pull (ERP → D1)", () => {
  it("the first get pulls the whole анкет inline: sections, interests, applications, CV, photo", async () => {
    await seedAccount();
    const profile = (await get("get")).retdata as Row;

    expect(profile.addr2).toBe("ERP хаяг"); // ERP value wins on the first pull
    expect(profile.firstname).toBe("Бат");
    expect(profile.filedata).toBe(CV_B64);
    expect(profile.picturedata).toBe("data:image/jpeg;base64,UElD");
    // The ERP's percentages are not copied; ours are computed from the sections.
    expect(profile.totalper).not.toBe(80);

    const edu = (await get("GetHrAppEducationData")).retdata as Record<string, Row[]>;
    expect(edu.hrappedulist).toEqual([{ entryid: 11, universitynametext: "МУИС", erp: "synced" }]);
    expect(edu.hrapplanglist.map((r) => r.entryid)).toEqual([12]);
    expect(((await get("GetHrAppFamilyData")).retdata as Record<string, Row[]>).hrappfamilylist).toHaveLength(1);
    expect(((await get("getInterestedJobsList")).retdata as Row[]).map((r) => r.entryid)).toEqual([15]);
    const apps = (await get("getRecruitmenRequestList")).retdata as Row[];
    expect(apps.map((r) => r.entryid)).toEqual([16]);
    expect(doc().erp?.appliedOrderIds).toEqual([786]);
    // Nothing was written to the ERP by a pull.
    expect(erp.calls.filter((c) => !/^(auth\/login|get|Get|getInterested|getRecruitmen)/.test(c.endpoint))).toEqual([]);
  });

  it("first pull keeps a D1 value where the ERP is blank, and marks it for sending", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await post("SaveHrApplicant", { regno: REGNO, mobilephone: PHONE, contactname: "D1 only", addr2: "D1 addr" });
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
    state.after = [];
    const profile = (await get("get")).retdata as Row;
    expect(profile).toMatchObject({ contactname: "D1 only", addr2: "ERP хаяг" });
    await runAfter();
    expect(erp.record).toMatchObject({ contactname: "D1 only", addr2: "ERP хаяг" });
  });

  it("login failure → D1 served as is, pull backs off", async () => {
    await seedAccount();
    erp.down = true;
    const profile = (await get("get")).retdata as Row;
    expect(profile.addr2).toBe("");
    expect(doc().erp?.pullFailures).toBe(1);
    erp.calls = [];
    await get("get");
    expect(erp.calls).toEqual([]); // backing off: no second attempt right away
  });

  it("existing D1 rows (entered here before sync) survive the first pull and are pushed", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await post("SaveHrApplicant", { regno: REGNO, mobilephone: PHONE });
    await post("SaveAppExperience", { entryid: 0, orgname: "Local LLC" });
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
    state.after = [];

    await get("get");
    const exp = ((await get("GetHrAppExperienceData")).retdata as Record<string, Row[]>).hrappexplist;
    expect(exp.map((r) => r.orgname)).toEqual(["Шунхлай", "Local LLC"]);
    expect(exp[1].erp).toBe("pending");

    await runAfter();
    const saved = erp.calls.find((c) => c.endpoint === "SaveAppExperience")!;
    expect(saved.body).toMatchObject({ entryid: 0, orgname: "Local LLC" });
    const after = ((await get("GetHrAppExperienceData")).retdata as Record<string, Row[]>).hrappexplist;
    expect(after.map((r) => [r.orgname, r.erp])).toEqual([
      ["Шунхлай", "synced"],
      ["Local LLC", "synced"],
    ]);
    expect(after[1].entryid).toBe(500); // adopted the ERP id
  });
});

describe("write-through (D1 → ERP)", () => {
  async function pulled() {
    await seedAccount();
    await get("get");
    await runAfter();
    erp.calls = [];
  }

  it("a new row saves locally, then is sent with entryid 0 and adopts the ERP id", async () => {
    await pulled();
    const r = await post("SaveHrAppEducation", { entryid: 0, universitynametext: "ШУТИС" });
    expect(r.rettype).toBe(0);
    expect(erp.calls).toEqual([]); // not on the request path
    expect(state.after).toHaveLength(1);
    await runAfter();
    expect(erp.calls.map((c) => c.endpoint)).toEqual(["auth/login", "SaveHrAppEducation", "GetHrAppEducationData"]);
    const list = ((await get("GetHrAppEducationData")).retdata as Record<string, Row[]>).hrappedulist;
    expect(list.map((r) => [r.entryid, r.erp])).toEqual([
      [11, "synced"],
      [500, "synced"],
    ]);
    expect(list[1]).not.toHaveProperty("appid"); // audit columns stripped
  });

  it("editing a synced row sends the ERP id", async () => {
    await pulled();
    await post("SaveAppExperience", { entryid: 13, orgname: "Шунхлай ХХК" });
    await runAfter();
    const saved = erp.calls.find((c) => c.endpoint === "SaveAppExperience")!;
    expect(saved.body).toMatchObject({ entryid: 13, orgname: "Шунхлай ХХК" });
    expect(erp.lists.hrappexplist).toEqual([{ entryid: 13, orgname: "Шунхлай ХХК" }]);
    expect(saved.body).not.toHaveProperty("erp");
  });

  it("deleting synced rows deletes them in the ERP with the exact query param", async () => {
    await pulled();
    await post("DeleteHrAppEducation", undefined, "?ENTRYID=11");
    await post("deleteInterestedJob", undefined, "?entryid=15");
    await post("DeleteOrderApp", undefined, "?entryID=16");
    expect(doc().erp?.pendingDeletes).toHaveLength(3);
    await runAfter();

    const deletes = erp.calls.filter((c) => /^delete/i.test(c.endpoint)).map((c) => [c.endpoint, c.query]);
    expect(deletes).toEqual([
      ["DeleteHrAppEducation", "?ENTRYID=11"],
      ["deleteInterestedJob", "?entryid=15"],
      ["DeleteOrderApp", "?entryID=16"],
    ]);
    expect(doc().erp?.pendingDeletes).toBeUndefined();
    expect(erp.lists.hrappedulist).toEqual([]);
    expect(erp.interests).toEqual([]);
    expect(erp.requests).toEqual([]);
  });

  it("a pull while a delete is queued does not bring the row back", async () => {
    await pulled();
    erp.down = true;
    await post("DeleteAppFamily", undefined, "?entryid=14");
    await runAfter(); // fails: stays queued
    erp.down = false;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    await get("get");
    const fam = ((await get("GetHrAppFamilyData")).retdata as Record<string, Row[]>).hrappfamilylist;
    expect(fam).toEqual([]);
    await runAfter();
    expect(erp.calls.some((c) => c.endpoint === "DeleteAppFamily" && c.query === "?entryid=14")).toBe(true);
    vi.useRealTimers();
  });

  it("deleting a local-only row makes no ERP call", async () => {
    await pulled();
    erp.down = true;
    const saved = (await post("SaveAppExperience", { entryid: 0, orgname: "Temp" })).retdata as Row;
    await runAfter();
    erp.down = false;
    erp.calls = [];
    await post("DeleteAppExperience", undefined, `?entryid=${saved.entryid}`);
    await runAfter();
    expect(erp.calls.filter((c) => /delete/i.test(c.endpoint))).toEqual([]);
    expect(doc().erp?.pendingDeletes).toBeUndefined();
  });

  it("an ERP 'not found' answer to a delete counts as done", async () => {
    await pulled();
    erp.lists.hrappedulist = []; // already gone in the ERP
    await post("DeleteHrAppEducation", undefined, "?ENTRYID=11");
    await runAfter();
    expect(doc().erp?.pendingDeletes).toBeUndefined();
  });

  it("a profile edit wins over the ERP and is not overwritten by a pull before it is sent", async () => {
    await pulled();
    erp.down = true;
    await post("SaveHrApplicant", { addr2: "Шинэ хаяг" });
    await runAfter();
    erp.down = false;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    await get("get");
    expect(((await get("get")).retdata as Row).addr2).toBe("Шинэ хаяг");
    await runAfter();
    expect(erp.record.addr2).toBe("Шинэ хаяг");
    expect(doc().erp?.profileDirty).toBeUndefined();
    vi.useRealTimers();
  });

  it("never re-submits a posting the ERP already lists as applied", async () => {
    await pulled();
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    expect(r.rettype).not.toBe(0);
    expect(erp.calls.filter((c) => c.endpoint === "SaveHrRecruitmentOrderApp")).toEqual([]);
  });

  it("a new application gets the one new ERP entry id", async () => {
    await pulled();
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 707 });
    await runAfter();
    const apps = (await get("getRecruitmenRequestList")).retdata as Row[];
    expect(apps.map((r) => r.entryid)).toEqual([16, 500]);
    expect(apps[1]).toMatchObject({ recruitmentorderid: 707, erp: { status: "sent", erpEntryId: 500 } });
  });

  // Login first: SaveHrAppUser is only the fallback for a 401 (a регистр new to
  // the ERP), so an applicant whose login works is never sent through it.
  it("never sends SaveHrAppUser while auth/login works", async () => {
    await pulled();
    await post("SaveHrApplicant", { addr2: "x" });
    await runAfter();
    expect(erp.calls.map((c) => c.endpoint)).not.toContain("SaveHrAppUser");
  });
});
