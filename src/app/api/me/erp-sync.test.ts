import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REGNO_LOCKED_MESSAGE } from "@/lib/applicant-identity";
import { ERP_DELETES, FakeErp, MISMATCH, type Row } from "@/server/applicant/fake-erp.fixture";

/**
 * Two-way D1 ⇄ ERP sync through /api/me, end to end: real SQLite (node:sqlite)
 * behind drizzle, a stateful fake ERP behind fetch, and `after()` queued so the
 * test decides when background work runs. Nothing reaches the network.
 */

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDb;
};

const state = vi.hoisted(() => {
  // Reference lookups (labels, postings) stay on the bundled mock data; only
  // the ERP client reads NEXT_PUBLIC_API_URL at call time (stubbed per test).
  delete process.env.NEXT_PUBLIC_API_URL;
  return {
    sqlite: null as null | {
      exec(sql: string): void;
      prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
    },
    userId: null as string | null,
    after: [] as Array<() => unknown>,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: unknown) => {
    state.after.push(typeof task === "function" ? (task as () => unknown) : () => task);
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: state.userId }),
  currentUser: async () =>
    state.userId
      ? {
          id: state.userId,
          firstName: "Clerk",
          lastName: "User",
          primaryEmailAddress: { emailAddress: "bat@site.mn" },
          emailAddresses: [{ emailAddress: "bat@site.mn" }],
        }
      : null,
}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { drizzle } = await import("drizzle-orm/sqlite-proxy");
  const db = drizzle(
    async (sql, params, method) => {
      const rows = (state.sqlite!.prepare(sql).all(...params) as Record<string, unknown>[]).map((r) =>
        Object.values(r),
      );
      return { rows: method === "get" ? (rows[0] ?? []) : rows };
    },
    { schema },
  );
  return { ...schema, schema, getDb: () => db };
});

import { GET, POST } from "./[...path]/route";

/* --- harness ------------------------------------------------------------- */

type Env = { rettype: number; retmsg: string; retdata: unknown };
const ctx = (endpoint: string) => ({ params: Promise.resolve({ path: endpoint.split("/") }) });

async function get(endpoint: string, query = "") {
  const res = await GET(new Request(`http://x/api/me/${endpoint}${query}`), ctx(endpoint) as never);
  return { status: res.status, body: (await res.json()) as Env };
}

async function post(endpoint: string, body?: unknown, query = "") {
  const init: RequestInit = { method: "POST" };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  const res = await POST(new Request(`http://x/api/me/${endpoint}${query}`, init), ctx(endpoint) as never);
  return { status: res.status, body: (await res.json()) as Env };
}

/** GET /api/me/cv → the downloaded bytes as base64 (null: no CV). */
async function cvBytes() {
  const res = await GET(new Request("http://x/api/me/cv"), ctx("cv") as never);
  return res.ok ? Buffer.from(await res.arrayBuffer()).toString("base64") : null;
}

async function flushAfter() {
  for (let guard = 0; state.after.length && guard < 20; guard += 1) await state.after.shift()!();
}

const q = (sql: string, ...p: unknown[]) => state.sqlite!.prepare(sql).all(...p) as Record<string, unknown>[];
const storedDoc = () => JSON.parse(String(q("select data_json from applicant_account")[0].data_json));

let erp: FakeErp;
let logs: string[];
let clock = Date.parse("2026-09-21T09:00:00Z");

/** Moves only Date forward (timers stay real). */
function advance(ms: number) {
  clock += ms;
  vi.setSystemTime(clock);
}

/** D1 account for this Clerk user with the ERP credentials, never pulled. */
function seedCredentials() {
  state.sqlite!
    .prepare("insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values (?, ?, ?, ?)")
    .run("p1", "u1", JSON.stringify({ regno: erp.regno, mobilephone: erp.phone }), Date.now());
}

/** A fake ERP holding one row in every section, a CV, a photo and an application. */
function richErp() {
  return new FakeErp((e) => {
    e.seedRow("hrappedulist", { schoolname: "МУИС", universityid: 3 });
    e.seedRow("hrapplanglist", { forlanguageid: 1, note: "Англи" });
    e.seedRow("hrappquallist", { qualname: "CPA" });
    e.seedRow("hrappcomplist", { skillcompid: 2, note: "Excel" });
    e.seedRow("hrappexplist", { orgname: "Шунхлай", jobid: 5 });
    e.seedRow("hrappprojectlist", { projectname: "ERP" });
    e.seedRow("hrappinternlist", { orgname: "Intern Co" });
    e.seedRow("hrappfamilylist", { firstname: "Эх" });
    e.seedRow("hrapprelativelist", { firstname: "Ах" });
    e.seedRow("interests", { posgroupid: 142, note: "Инженер" });
    e.recruitmentorders.push({ recruitmentorderid: 707 });
    e.lists.requests.push({ entryid: e.id(), recruitmentorderid: 707, posname: "Нягтлан", statusname: "Хүлээн авсан" });
    e.record.filedata = Buffer.from("ERP-CV-BYTES").toString("base64");
    e.record.filename = "erp-cv.pdf";
    e.record.picturedata = Buffer.from([0xff, 0xd8, 0xff, 0x01]).toString("base64");
  });
}

const lists = async () => {
  const edu = (await get("GetHrAppEducationData")).body.retdata as Record<string, Row[]>;
  const exp = (await get("GetHrAppExperienceData")).body.retdata as Record<string, Row[]>;
  const fam = (await get("GetHrAppFamilyData")).body.retdata as Record<string, Row[]>;
  return {
    education: edu.hrappedulist,
    languages: edu.hrapplanglist,
    qualifications: edu.hrappquallist,
    skills: edu.hrappcomplist,
    experience: exp.hrappexplist,
    projects: exp.hrappprojectlist,
    internships: exp.hrappinternlist,
    family: fam.hrappfamilylist,
    relatives: fam.hrapprelativelist,
    interests: (await get("getInterestedJobsList")).body.retdata as Row[],
    applications: (await get("getRecruitmenRequestList")).body.retdata as Row[],
  };
};

async function firstLoad(fake: FakeErp = richErp()) {
  erp = fake;
  vi.stubGlobal("fetch", erp.fetch);
  seedCredentials();
  const r = await get("get");
  await flushAfter();
  return r;
}

function freshDb() {
  state.sqlite = new DatabaseSync(":memory:");
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) state.sqlite!.exec(stmt);
    }
  }
}

beforeEach(() => {
  freshDb();
  state.userId = "u1";
  state.after = [];
  clock = Date.parse("2026-09-21T09:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
  erp = new FakeErp();
  vi.stubGlobal("fetch", erp.fetch);
  logs = [];
  const capture = (...a: unknown[]) =>
    logs.push(a.map((x) => (x instanceof Error ? `${x.message} ${x.stack}` : typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation(capture);
  }
});

afterEach(() => {
  // Global invariants, checked after EVERY test.
  // SaveHrAppUser only ever right after a refused auth/login (login first, so
  // an applicant the ERP knows is never sent through it; Postman 01/02).
  const sent = erp.endpoints();
  sent.forEach((endpoint, i) => {
    if (endpoint === "SaveHrAppUser") expect(sent[i - 1], "SaveHrAppUser only after auth/login").toBe("auth/login");
  });
  const all = logs.join("\n");
  expect(all).not.toContain(erp.regno);
  expect(all).not.toContain(erp.phone);
  expect(all).not.toContain(erp.token);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* --- pull ---------------------------------------------------------------- */

describe("first load (pull)", () => {
  it("imports every section, the profile, the CV/photo and the applications", async () => {
    const r = await firstLoad();
    expect(r.status).toBe(200);
    const p = r.body.retdata as Row;
    // The very first response already carries the ERP profile and files (inline pull).
    expect(p).toMatchObject({ lastname: "Дорж", firstname: "Бат", addr2: "ERP хаяг", custom1: "ERP custom", regno: erp.regno });
    expect(p.filename).toBe("erp-cv.pdf");
    expect(p).not.toHaveProperty("filedata");
    expect(await cvBytes()).toBe(erp.record.filedata);
    expect(String(p.picturedata)).toContain(String(erp.record.picturedata));

    const l = await lists();
    for (const [key, rows] of Object.entries(l)) expect(rows, key).toHaveLength(1);
    // ERP rows keep their ERP entry ids.
    expect(l.education[0].entryid).toBe(erp.lists.hrappedulist[0].entryid);
    expect(l.education[0].schoolname).toBe("МУИС");
    expect(l.applications[0].posname).toBe("Нягтлан");
    // Pulling is read-only.
    expect(erp.endpoints().filter((e) => /^(Save|Delete|delete)/.test(e))).toEqual([]);
  });

  it("10-minute throttle: no pull within 10 min, background pull after", async () => {
    await firstLoad();
    const gets = () => erp.endpoints().filter((e) => e === "get").length;
    const before = gets();
    advance(5 * 60_000);
    await get("get");
    await flushAfter();
    expect(gets()).toBe(before);

    erp.lists.hrappedulist.push({ entryid: erp.id(), schoolname: "Шинэ сургууль" });
    advance(6 * 60_000);
    await get("get");
    expect(gets()).toBe(before); // not inline
    await flushAfter();
    expect(gets()).toBe(before + 1);
    expect((await lists()).education.map((r) => r.schoolname)).toContain("Шинэ сургууль");
  });

  it("the inline first pull respects its ~8s budget, then finishes in after()", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(clock);
    erp = richErp();
    erp.delayMs = 9_000; // login alone takes 9s: well past the 8s budget, under the 10s call timeout
    vi.stubGlobal("fetch", erp.fetch);
    seedCredentials();

    let answered = false;
    const pending = get("get").then((r) => {
      answered = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(7_500);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000); // 8.5s
    expect(answered).toBe(true);
    const r = await pending;
    expect(r.status).toBe(200);
    expect((r.body.retdata as Row).addr2).not.toBe("ERP хаяг"); // served from D1

    const run = flushAfter();
    await vi.advanceTimersByTimeAsync(30_000);
    await run;
    expect((await get("get")).body.retdata).toMatchObject({ addr2: "ERP хаяг" });
  });

  it("a row deleted on the ERP side is removed on the next pull, unless pending locally", async () => {
    await firstLoad();
    const l = await lists();
    // Local pending edit on education; ERP deletes both education and experience.
    await post("SaveHrAppEducation", { ...l.education[0], note: "local edit" });
    state.after = []; // keep the flush from running
    erp.lists.hrappedulist = [];
    erp.lists.hrappexplist = [];
    advance(11 * 60_000);
    // Make the local flush fail so the edit stays pending during this pull.
    erp.refuse.set("SaveHrAppEducation", "түр алдаа");
    await get("get");
    await flushAfter();
    const after = await lists();
    expect(after.experience).toEqual([]);
    expect(after.education).toHaveLength(1);
    expect(after.education[0].note).toBe("local edit");
  });
});

/* --- write-through ---------------------------------------------------------- */

describe("write-through", () => {
  it("edit of a synced row → ERP save with the ERP entryid → row back to synced", async () => {
    await firstLoad();
    const [row] = (await lists()).experience;
    const erpId = row.entryid;
    const r = await post("SaveAppExperience", { ...row, orgname: "Шунхлай ХХК" });
    expect(r.body.rettype).toBe(0);
    expect(storedDoc().experience[0].erp).toBe("pending");
    await flushAfter();

    const save = erp.calls.find((c) => c.endpoint === "SaveAppExperience")!;
    expect((save.body as Row).entryid).toBe(erpId);
    expect(save.body as Row).not.toHaveProperty("erp");
    expect(erp.lists.hrappexplist).toHaveLength(1);
    expect(erp.lists.hrappexplist[0]).toMatchObject({ entryid: erpId, orgname: "Шунхлай ХХК" });
    const stored = storedDoc().experience;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ entryid: erpId, erp: "synced", orgname: "Шунхлай ХХК" });
  });

  it("create → ERP save with entryid 0 → row adopts the ERP id, no duplicates after the next pull", async () => {
    await firstLoad();
    const created = await post("SaveAppForLanguage", { entryid: 0, forlanguageid: 7, note: "Орос" });
    const localId = Number((created.body.retdata as Row).entryid);
    expect(localId).toBeGreaterThanOrEqual(1_000_000_000);
    await flushAfter();

    const save = erp.calls.find((c) => c.endpoint === "SaveAppForLanguage")!;
    expect((save.body as Row).entryid).toBe(0);
    const erpRow = erp.lists.hrapplanglist.find((r) => r.note === "Орос")!;
    expect(Number(erpRow.entryid)).toBeLessThan(1_000_000_000);

    let langs = (await lists()).languages;
    expect(langs.filter((r) => r.note === "Орос")).toHaveLength(1);
    expect(langs.find((r) => r.note === "Орос")!.entryid).toBe(erpRow.entryid);

    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    langs = (await lists()).languages;
    expect(langs.filter((r) => r.note === "Орос")).toHaveLength(1);
    expect(langs).toHaveLength(2);
    expect(erp.lists.hrapplanglist).toHaveLength(2);
  });

  it("batch sections (skills, family) save arrays with entryid 0 for new rows", async () => {
    await firstLoad();
    await post("SaveAppSkillComp", [{ entryid: 0, skillcompid: 9, note: "Python" }]);
    await flushAfter();
    const save = erp.calls.find((c) => c.endpoint === "SaveAppSkillComp")!;
    expect(Array.isArray(save.body)).toBe(true);
    expect((save.body as Row[]).find((r) => r.note === "Python")!.entryid).toBe(0);
    expect(erp.lists.hrappcomplist.filter((r) => r.note === "Python")).toHaveLength(1);
    expect((await lists()).skills.filter((r) => r.note === "Python")).toHaveLength(1);
  });

  it("a pull while local rows are pending does not overwrite them", async () => {
    await firstLoad();
    const [row] = (await lists()).education;
    erp.down = true;
    await post("SaveHrAppEducation", { ...row, schoolname: "Локал засвар" });
    await flushAfter(); // flush fails: stays pending
    erp.down = false;
    erp.lists.hrappedulist[0].schoolname = "ERP засвар";
    advance(11 * 60_000);
    erp.refuse.set("SaveHrAppEducation", "түр алдаа"); // keep it pending through this visit
    await get("get");
    await flushAfter();
    const edu = (await lists()).education;
    expect(edu).toHaveLength(1);
    expect(edu[0].schoolname).toBe("Локал засвар");
  });

  it("a dirty profile is not overwritten by a pull; after the flush the ERP has it (and keeps its other fields)", async () => {
    await firstLoad();
    erp.down = true;
    await post("SaveHrApplicant", { ...((await get("get")).body.retdata as Row), addr2: "Шинэ хаяг" });
    await flushAfter();
    erp.down = false;
    erp.record.addr2 = "ERP-ийн өөр хаяг";
    advance(11 * 60_000);
    erp.refuse.set("SaveHrApplicant", "түр алдаа");
    await get("get");
    await flushAfter();
    expect(((await get("get")).body.retdata as Row).addr2).toBe("Шинэ хаяг");

    erp.refuse.delete("SaveHrApplicant");
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.record.addr2).toBe("Шинэ хаяг");
    expect(erp.record).toMatchObject({ custom1: "ERP custom", contactname: "ERP холбоо", isa: true, regno: erp.regno, mobilephone: erp.phone });
    expect(storedDoc().erp?.profileDirty).toBeUndefined();
  });

  it("a field emptied here is emptied in the ERP too, and the next pull does not bring it back", async () => {
    const fake = richErp();
    Object.assign(fake.record, { contactname2: "Хоёр дахь", relativeid2: 22, contactphone2: "88887777" });
    await firstLoad(fake);
    const loaded = (await get("get")).body.retdata as Row;
    expect(loaded).toMatchObject({ addr2: "ERP хаяг", contactname2: "Хоёр дахь", relativeid2: 22 });

    // What the profile form sends when the second contact and the address are cleared.
    await post("SaveHrApplicant", { ...loaded, addr2: "", contactname2: "", relativeid2: null, contactphone2: "" });
    expect(storedDoc().erp.profileCleared).toEqual(expect.arrayContaining(["addr2", "contactname2", "relativeid2", "contactphone2"]));
    await flushAfter();

    const save = erp.calls.find((c) => c.endpoint === "SaveHrApplicant")!.body as Row;
    expect(save).toMatchObject({ addr2: "", contactname2: "", contactphone2: "" });
    expect(save).not.toHaveProperty("relativeid2"); // a blank id is left out: the full replace resets it
    expect(erp.record).toMatchObject({ addr2: "", contactname2: "", contactphone2: "" });
    expect(erp.record.relativeid2).toBeUndefined();
    // The rest of the record, and the login, are untouched.
    expect(erp.record).toMatchObject({ lastname: "Дорж", firstname: "Бат", regno: erp.regno, mobilephone: erp.phone, custom1: "ERP custom" });
    expect(storedDoc().erp.profileCleared).toBeUndefined();

    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect((await get("get")).body.retdata).toMatchObject({ addr2: "", contactname2: "", contactphone2: "" });
    expect(((await get("get")).body.retdata as Row).relativeid2 ?? null).toBeNull();
  });

  it("emptied, then filled again before the flush: the new value goes, nothing is cleared", async () => {
    await firstLoad();
    erp.down = true;
    await post("SaveHrApplicant", { addr2: "", contactname: "" });
    await flushAfter();
    expect(storedDoc().erp.profileCleared).toEqual(["addr2", "contactname"]);
    await post("SaveHrApplicant", { addr2: "Шинэ хаяг" });
    expect(storedDoc().erp.profileCleared).toEqual(["contactname"]);
    erp.down = false;
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.record).toMatchObject({ addr2: "Шинэ хаяг", contactname: "" });
    expect(storedDoc().erp.profileCleared).toBeUndefined();
  });

  it("a field that was blank here all along is not a clearing: the ERP keeps its value", async () => {
    // Saved here before the first pull: D1 never saw the ERP's addr2 / custom1.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await post("SaveHrApplicant", { regno: erp.regno, mobilephone: erp.phone, addr2: "", custom1: "" });
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
    state.after = [];
    expect(storedDoc().erp.profileCleared).toBeUndefined();
    await get("get");
    await flushAfter();
    expect(erp.record).toMatchObject({ addr2: "ERP хаяг", custom1: "ERP custom" });
  });

  it("the ERP's maritalstatus[] reaches /api/me/get, and a stored code outside it is kept", async () => {
    const fake = richErp();
    fake.marital = [
      { key: "S", text: "Ганц бие" },
      { key: "M", text: "Гэрлэсэн" },
    ];
    fake.record.maritalstatus = "X";
    await firstLoad(fake);
    const p = (await get("get")).body.retdata as Row;
    expect(p.maritalOptions).toEqual([
      { key: "S", text: "Ганц бие" },
      { key: "M", text: "Гэрлэсэн" },
    ]);
    expect(p.maritalstatus).toBe("X");
    expect(storedDoc().profile).not.toHaveProperty("maritalOptions");

    // Never echoed back to the ERP.
    await post("SaveHrApplicant", { ...p, maritalstatus: "S" });
    await flushAfter();
    const save = erp.calls.find((c) => c.endpoint === "SaveHrApplicant")!.body as Row;
    expect(save.maritalstatus).toBe("S");
    expect(save).not.toHaveProperty("maritalOptions");
  });

  it("a photo goes to SaveAppPicture as multipart field `file`; the pulled picturedata is served as a data URL", async () => {
    await firstLoad();
    const pulled = (await get("get")).body.retdata as Row;
    expect(pulled.picturedata).toBe(`data:image/jpeg;base64,${erp.record.picturedata}`);

    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0x02])], "me.jpg", { type: "image/jpeg" }));
    expect((await post("SaveAppPicture", fd)).body.rettype).toBe(0);
    await flushAfter();
    const call = erp.calls.find((c) => c.endpoint === "SaveAppPicture")!;
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({
      field: "file",
      type: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0x02]).toString("base64"),
    });
    expect(erp.record.picturedata).toBe(Buffer.from([0xff, 0xd8, 0xff, 0x02]).toString("base64"));
  });

  it("ERP down during the flush → stays pending → the next due get retries and succeeds", async () => {
    await firstLoad();
    erp.down = true;
    await post("SaveInterestedJobItem", { entryid: 0, posgroupid: 142, note: "Retry me" });
    await flushAfter();
    expect(storedDoc().interests.find((r: Row) => r.note === "Retry me").erp).toBe("pending");

    erp.down = false;
    advance(60_000); // not due yet (backoff)
    await get("get");
    await flushAfter();
    expect(erp.lists.interests.filter((r) => r.note === "Retry me")).toHaveLength(0);

    advance(10 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.lists.interests.filter((r) => r.note === "Retry me")).toHaveLength(1);
    expect(storedDoc().interests.find((r: Row) => r.note === "Retry me").erp).toBe("synced");
  });

  it("flush retries are capped (no unbounded attempts)", async () => {
    await firstLoad();
    erp.down = true;
    await post("SaveInterestedJobItem", { entryid: 0, posgroupid: 142, note: "Never" });
    await flushAfter();
    for (let i = 0; i < 12; i += 1) {
      advance(60 * 60_000);
      await get("get");
      await flushAfter();
    }
    const saves = erp.calls.filter((c) => c.endpoint === "SaveInterestedJobItem").length;
    const logins = erp.calls.filter((c) => c.endpoint === "auth/login").length;
    // Login fails while down, so saves never even go out; attempts must stop at 5.
    expect(storedDoc().erp.flush.attempts).toBeLessThanOrEqual(5);
    expect(saves + logins).toBeLessThan(40);
  });
});

/* --- deletes: every section --------------------------------------------- */

type DeleteCase = {
  name: string;
  list: keyof FakeErp["lists"];
  /** UI list accessor over the /api/me lists. */
  ui: keyof Awaited<ReturnType<typeof lists>>;
  save: string;
  saveBody: Row | Row[];
  del: string;
  /** Query param the browser client sends (factories removeParam). */
  clientParam: string;
};

const DELETE_CASES: DeleteCase[] = [
  { name: "education", list: "hrappedulist", ui: "education", save: "SaveHrAppEducation", saveBody: { entryid: 0, schoolname: "L" }, del: "DeleteHrAppEducation", clientParam: "ENTRYID" },
  { name: "language", list: "hrapplanglist", ui: "languages", save: "SaveAppForLanguage", saveBody: { entryid: 0, note: "L" }, del: "DeleteAppForLanguage", clientParam: "entryid" },
  { name: "skill", list: "hrappcomplist", ui: "skills", save: "SaveAppSkillComp", saveBody: [{ entryid: 0, note: "L" }], del: "DeleteAppSkillComp", clientParam: "entryid" },
  { name: "experience", list: "hrappexplist", ui: "experience", save: "SaveAppExperience", saveBody: { entryid: 0, orgname: "L" }, del: "DeleteAppExperience", clientParam: "entryid" },
  { name: "family", list: "hrappfamilylist", ui: "family", save: "SaveAppFamily", saveBody: [{ entryid: 0, firstname: "L" }], del: "DeleteAppFamily", clientParam: "entryid" },
  { name: "interest", list: "interests", ui: "interests", save: "SaveInterestedJobItem", saveBody: { entryid: 0, note: "L" }, del: "deleteInterestedJob", clientParam: "entryid" },
  { name: "application", list: "requests", ui: "applications", save: "SaveHrRecruitmentOrderApp", saveBody: { recruitmentorderid: 786 }, del: "DeleteOrderApp", clientParam: "entryID" },
];

describe.each(DELETE_CASES)("delete: $name", (c) => {
  const postmanParam = ERP_DELETES[c.del].param;

  it(`sends ${c.del}?${postmanParam}=<ERP id>, the row leaves the ERP, and a pull does not bring it back`, async () => {
    await firstLoad();
    const [row] = (await lists())[c.ui];
    const erpId = Number(row.entryid);
    expect(erp.lists[c.list].some((r) => Number(r.entryid) === erpId)).toBe(true);

    const r = await post(c.del, undefined, `?${c.clientParam}=${row.entryid}`);
    expect(r.body.rettype).toBe(0);
    expect((await lists())[c.ui]).toEqual([]);
    await flushAfter();

    const call = erp.calls.find((x) => x.endpoint === c.del);
    expect(call, `${c.del} sent`).toBeDefined();
    expect(call!.method).toBe("POST");
    expect(call!.params.get(postmanParam)).toBe(String(erpId));
    expect(erp.lists[c.list].some((r2) => Number(r2.entryid) === erpId)).toBe(false);

    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect((await lists())[c.ui]).toEqual([]);
  });

  it("a pull before the flush does NOT resurrect the deleted row", async () => {
    await firstLoad();
    const [row] = (await lists())[c.ui];
    erp.down = true;
    await post(c.del, undefined, `?${c.clientParam}=${row.entryid}`);
    await flushAfter(); // flush fails, delete stays queued
    erp.down = false;
    erp.refuse.set(c.del, "түр алдаа"); // and keeps failing on the next visit
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.lists[c.list]).toHaveLength(1); // still in the ERP…
    expect((await lists())[c.ui]).toEqual([]); // …but not resurrected here
  });

  it("deleting a local-only pending row makes no ERP delete call", async () => {
    await firstLoad();
    erp.down = true; // the create never reaches the ERP
    await post(c.save, c.saveBody);
    await flushAfter();
    const local = (await lists())[c.ui].find((r) => Number(r.entryid) >= 1_000_000_000)!;
    expect(local).toBeDefined();
    erp.down = false;
    erp.calls = [];
    await post(c.del, undefined, `?${c.clientParam}=${local.entryid}`);
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.calls.filter((x) => x.endpoint === c.del)).toEqual([]);
    expect((await lists())[c.ui].some((r) => r.entryid === local.entryid)).toBe(false);
  });

  it("an ERP 'not found' answer counts as done", async () => {
    await firstLoad();
    const [row] = (await lists())[c.ui];
    erp.lists[c.list] = []; // already gone in the ERP
    await post(c.del, undefined, `?${c.clientParam}=${row.entryid}`);
    await flushAfter();
    expect(erp.calls.filter((x) => x.endpoint === c.del)).toHaveLength(1);
    expect(storedDoc().erp?.pendingDeletes ?? []).toEqual([]);
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.calls.filter((x) => x.endpoint === c.del)).toHaveLength(1); // not retried
  });

  it("ERP down → stays queued → the next due get retries it", async () => {
    await firstLoad();
    const [row] = (await lists())[c.ui];
    erp.down = true;
    await post(c.del, undefined, `?${c.clientParam}=${row.entryid}`);
    await flushAfter();
    expect(storedDoc().erp.pendingDeletes).toEqual([{ endpoint: c.del, entryid: Number(row.entryid) }]);
    erp.down = false;
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.lists[c.list]).toEqual([]);
    expect(storedDoc().erp?.pendingDeletes ?? []).toEqual([]);
  });
});

describe("delete: CV (deleteAppCV)", () => {
  it("sends deleteAppCV (no params) and the ERP loses the CV; a pull does not bring it back", async () => {
    await firstLoad();
    expect(((await get("get")).body.retdata as Row).filename).toBe("erp-cv.pdf");
    expect((await post("deleteAppCV")).body.rettype).toBe(0);
    await flushAfter();
    const call = erp.calls.find((x) => x.endpoint === "deleteAppCV");
    expect(call).toBeDefined();
    expect([...call!.params.keys()]).toEqual([]);
    expect(erp.record.filedata ?? null).toBeNull();
    // Gone from D1 as well: no file rows, nothing to download.
    expect(q("select * from applicant_file where kind = 'cv'")).toEqual([]);
    expect(await cvBytes()).toBeNull();
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(((await get("get")).body.retdata as Row).filename).toBeNull();
  });

  it("ERP down → stays queued, a pull meanwhile does not restore it, the next due get retries", async () => {
    await firstLoad();
    erp.down = true;
    await post("deleteAppCV");
    await flushAfter();
    erp.down = false;
    erp.refuse.set("deleteAppCV", "түр алдаа");
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(((await get("get")).body.retdata as Row).filename).toBeNull(); // not restored
    erp.refuse.delete("deleteAppCV");
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.record.filedata ?? null).toBeNull();
  });

  it("deleting a CV that was only ever local makes no ERP call", async () => {
    erp = new FakeErp();
    await firstLoad(erp);
    erp.down = true;
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "local.pdf"));
    await post("SaveAppCV", fd);
    await flushAfter();
    erp.down = false;
    erp.calls = [];
    await post("deleteAppCV");
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.endpoints()).not.toContain("deleteAppCV");
    expect(erp.endpoints()).not.toContain("SaveAppCV");
  });
});

describe("CV upload and pull (SaveAppCV)", () => {
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const upload = (name: string, bytes: number[]) => {
    const fd = new FormData();
    // No type, as some browsers report a .docx: the ERP part is typed from the name.
    fd.set("file", new File([new Uint8Array(bytes)], name));
    return post("SaveAppCV", fd);
  };

  it("reaches the ERP as multipart `file` with its name and the MIME type from the extension", async () => {
    await firstLoad();
    expect((await upload("Бат CV.docx", [5, 6, 7])).body.rettype).toBe(0);
    await flushAfter();
    const call = erp.calls.find((c) => c.endpoint === "SaveAppCV")!;
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({
      field: "file",
      filename: "Бат CV.docx",
      type: DOCX,
      bytes: Buffer.from([5, 6, 7]).toString("base64"),
    });
    expect(erp.record.filename).toBe("Бат CV.docx");
    expect(storedDoc().erp?.cvDirty).toBeUndefined();
  });

  it("a refused file type marks nothing for the ERP and sends nothing", async () => {
    await firstLoad();
    erp.calls = [];
    const r = await upload("cv.exe", [1]);
    expect(r.body.rettype).not.toBe(0);
    const photo = new FormData();
    photo.set("file", new File([new TextEncoder().encode("GIF89a")], "me.jpg"));
    expect((await post("SaveAppPicture", photo)).body.rettype).not.toBe(0);
    await flushAfter();
    expect(storedDoc().erp?.cvDirty).toBeUndefined();
    expect(storedDoc().erp?.pictureDirty).toBeUndefined();
    expect(erp.endpoints()).not.toContain("SaveAppCV");
    expect(erp.endpoints()).not.toContain("SaveAppPicture");
    expect(await cvBytes()).toBe(erp.record.filedata); // the ERP's CV is still the one here
  });

  it("a pull never clobbers a newer local upload that has not reached the ERP yet", async () => {
    await firstLoad(); // the ERP holds erp-cv.pdf
    erp.refuse.set("SaveAppCV", "түр алдаа");
    await upload("new.pdf", [9, 9]);
    await flushAfter();
    // Meanwhile the ERP's own copy changes too (another client) — ours is newer.
    erp.record.filename = "erp-other.pdf";
    erp.record.filedata = Buffer.from("OTHER").toString("base64");
    advance(11 * 60_000); // stale: this get pulls again while the upload is still unsent
    await get("get");
    await flushAfter();
    expect(erp.endpoints().filter((e) => e === "get").length).toBeGreaterThan(1);
    expect(((await get("get")).body.retdata as Row).filename).toBe("new.pdf");
    expect(await cvBytes()).toBe(Buffer.from([9, 9]).toString("base64"));

    erp.refuse.delete("SaveAppCV");
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.record).toMatchObject({ filename: "new.pdf", filedata: Buffer.from([9, 9]).toString("base64") });
  });

  it("a CV replaced in the ERP while in sync here is pulled into D1", async () => {
    await firstLoad();
    erp.record.filename = "erp-new.pdf";
    erp.record.filedata = Buffer.from("NEWER").toString("base64");
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(((await get("get")).body.retdata as Row).filename).toBe("erp-new.pdf");
    expect(await cvBytes()).toBe(erp.record.filedata);
    expect(erp.endpoints()).not.toContain("SaveAppCV"); // nothing pushed back
  });
});

describe("read-only sections (qualifications/projects/internships/relatives)", () => {
  it("have no ERP delete endpoint in the Postman collection and the /api/me has none either", async () => {
    await firstLoad();
    for (const ep of ["DeleteAppQualification", "DeleteAppProject", "DeleteAppIntern", "DeleteAppRelative"]) {
      const r = await post(ep, undefined, "?entryid=1");
      expect(r.status).toBe(404);
    }
    expect((await lists()).qualifications).toHaveLength(1);
  });
});

/* --- applications ----------------------------------------------------------- */

describe("application entry id", () => {
  it("exactly one new ERP id after the submit → set", async () => {
    await firstLoad();
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    const app = (await lists()).applications.find((r) => Number(r.recruitmentorderid) === 786 || r.posname === "ERP pos")!;
    const erpRow = erp.lists.requests.find((r) => Number(r.recruitmentorderid) === 786)!;
    expect((app.erp as Row)?.erpEntryId ?? app.entryid).toBe(erpRow.entryid);
  });

  it("ambiguous (another application appeared at the same time) → left unset", async () => {
    await firstLoad();
    // Someone applies on the ERP site in between: two new ids appear.
    const original = erp.fetch;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const res = await original(input, init);
      if (String(input).endsWith("/SaveHrRecruitmentOrderApp")) {
        erp.lists.requests.push({ entryid: erp.id(), recruitmentorderid: 999, posname: "Other" });
      }
      return res;
    });
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    const stored = storedDoc().applications as Row[];
    const mine = stored.find((r) => Number(r.recruitmentorderid) === 786);
    // Either still our local row without an ERP id, or not folded into a guessed one.
    if (mine) expect((mine.erp as Row)?.erpEntryId).toBeUndefined();
    const guessed = stored.filter((r) => Number((r.erp as Row)?.erpEntryId) > 0 && Number(r.recruitmentorderid) === 786);
    expect(guessed).toEqual([]);
  });
});

/* --- ERP account (SaveHrAppUser) ------------------------------------------ */

describe("ERP account: login first, SaveHrAppUser on a 401", () => {
  /** A never-pulled D1 account with these identity values (names from Clerk). */
  async function seedIdentity(profile: Row) {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await post("SaveHrApplicant", profile);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
    state.after = [];
    erp.calls = [];
  }

  it("a регистр new to the ERP is registered with the D1 identity, and that token pulls", async () => {
    erp = new FakeErp((e) => {
      e.registered = false;
    });
    vi.stubGlobal("fetch", erp.fetch);
    await seedIdentity({ regno: "АА00000000", mobilephone: "88001122" });

    const r = await get("get");
    expect(r.body.rettype).toBe(0);
    expect(erp.endpoints().slice(0, 3)).toEqual(["auth/login", "SaveHrAppUser", "get"]);
    expect(erp.calls[1].body).toEqual({
      lastname: "User",
      firstname: "Clerk",
      regno: "АА00000000",
      email: "bat@site.mn",
      mobilephone: "88001122",
    });
    expect(erp.calls.slice(2).every((c) => c.auth === `Bearer ${erp.token}`)).toBe(true);
    expect(erp.registered).toBe(true);
    expect(storedDoc().erp.pulledAt).toEqual(expect.any(String));
    expect((r.body.retdata as Row).erplinked).toBe(true);

    // Registered now: the next sync just logs in.
    await post("SaveAppExperience", { entryid: 0, orgname: "Local" });
    erp.calls = [];
    await flushAfter();
    expect(erp.endpoints()).not.toContain("SaveHrAppUser");
    expect(erp.lists.hrappexplist.map((row) => row.orgname)).toEqual(["Local"]);
  });

  it("an existing регистр with another phone: one SaveHrAppUser, message kept on the doc, no loop", async () => {
    await seedIdentity({ regno: erp.regno, mobilephone: "88000000" });

    await get("get");
    await flushAfter();
    expect(erp.endpoints()).toEqual(["auth/login", "SaveHrAppUser"]);
    expect(erp.record.mobilephone).toBe(erp.phone); // the ERP record is untouched
    const stored = storedDoc();
    expect(stored.erp.linkError).toBe(MISMATCH);
    expect(stored.erp.pullFailures).toBe(1);
    expect(stored.erp.pulledAt).toBeUndefined();

    // Backing off: an immediate second visit makes no call.
    erp.calls = [];
    await get("get");
    await flushAfter();
    expect(erp.calls).toEqual([]);

    // Fixing the phone clears the stale message; the next due pull logs in.
    await post("SaveHrApplicant", { mobilephone: erp.phone });
    expect(storedDoc().erp.linkError).toBeUndefined();
  });

  it("refused credentials are never re-sent — not after the backoff either — until утас changes", async () => {
    await seedIdentity({ regno: erp.regno, mobilephone: "88000000" });
    await get("get");
    await flushAfter();
    const count = (endpoint: string) => erp.endpoints().filter((e) => e === endpoint).length;
    expect(count("SaveHrAppUser")).toBe(1);

    advance(48 * 60 * 60_000); // far past any backoff
    await post("SaveAppExperience", { entryid: 0, orgname: "Local" }); // local work waits
    await get("get");
    await flushAfter();
    expect(count("SaveHrAppUser")).toBe(1);
    expect(count("auth/login")).toBe(1);
    expect((await get("get")).body.retdata).toMatchObject({ erplinkerror: MISMATCH, erplinked: false });

    // The right phone: refusal and backoff lifted, the next visit logs in and the waiting work goes.
    await post("SaveHrApplicant", { mobilephone: erp.phone });
    expect(storedDoc().erp).not.toHaveProperty("linkError");
    expect(storedDoc().erp).not.toHaveProperty("pullFailures");
    const r = await get("get");
    await flushAfter();
    expect(count("SaveHrAppUser")).toBe(1);
    expect(r.body.retdata).toMatchObject({ erplinkerror: null, erplinked: true });
    expect(erp.lists.hrappexplist.map((row) => row.orgname)).toEqual(["Local"]);
  });

  it("a LINKED account whose утас changes here: the ERP password follows (changeUserInfo), then the new pair", async () => {
    await firstLoad(); // linked by this pull, with the утас that logged in
    const oldPhone = erp.phone;
    expect(storedDoc().erp).toMatchObject({ linkedRegno: erp.regno, loginPhone: oldPhone });
    erp.calls = [];

    await post("SaveHrApplicant", { mobilephone: "88000000" });
    // The last-good утас stays on the server: never in a response.
    expect(JSON.stringify((await get("get")).body)).not.toContain(oldPhone);
    await flushAfter();

    expect(erp.endpoints().slice(0, 3)).toEqual(["auth/login", "changeUserInfo", "auth/login"]);
    expect(erp.calls[0].body).toEqual({ regNo: erp.regno, mobile: oldPhone });
    expect(erp.calls[1].auth).toBe(`Bearer ${erp.token}`);
    expect(erp.calls[1].body).toEqual({
      phonenumber: "88000000",
      email: "bat@erp.mn",
      oldpassword: oldPhone,
      newpassword: "88000000",
      type: "PASSWORD",
    });
    expect(erp.calls[2].body).toEqual({ regNo: erp.regno, mobile: "88000000" });
    expect(erp.endpoints()).not.toContain("SaveHrAppUser");
    expect(erp.phone).toBe("88000000"); // what auth/login compares now
    // SaveHrApplicant carries the D1 утас: the ERP record's phone is the new one too.
    const save = erp.calls.find((c) => c.endpoint === "SaveHrApplicant")!;
    expect((save.body as Row).mobilephone).toBe("88000000");
    expect(erp.record.mobilephone).toBe("88000000");
    expect(storedDoc().erp.loginPhone).toBe("88000000");
    expect(storedDoc().erp.linkError).toBeUndefined();

    // From now on a plain login with the new pair.
    erp.calls = [];
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.endpoints().filter((e) => e === "auth/login")).toHaveLength(1);
    expect(erp.endpoints()).not.toContain("changeUserInfo");
    expect(logs.join("\n")).not.toContain(oldPhone);
    expect(logs.join("\n")).not.toContain("88000000");
  });

  it("changeUserInfo refused: its own message is shown, nothing loops, a new утас tries again", async () => {
    await firstLoad();
    const oldPhone = erp.phone;
    erp.refuse.set("changeUserInfo", "Нууц үг солих боломжгүй байна.");
    erp.calls = [];

    await post("SaveHrApplicant", { mobilephone: "88000000" });
    await flushAfter();
    // Old pair → refused change → the new pair once (not the password yet) → stop.
    expect(erp.endpoints()).toEqual(["auth/login", "changeUserInfo", "auth/login"]);
    expect(erp.phone).toBe(oldPhone);
    expect(storedDoc().erp.linkError).toBe("Нууц үг солих боломжгүй байна.");
    expect((await get("get")).body.retdata).toMatchObject({ erplinkerror: "Нууц үг солих боломжгүй байна." });
    expect(storedDoc().profile.mobilephone).toBe("88000000"); // D1 keeps what was typed

    erp.calls = [];
    advance(48 * 60 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.calls).toEqual([]);

    // Back to the утас the ERP knows: a plain login, the waiting profile goes.
    erp.refuse.delete("changeUserInfo");
    await post("SaveHrApplicant", { mobilephone: oldPhone });
    await flushAfter();
    expect(erp.endpoints()).toEqual(["auth/login", "get", "SaveHrApplicant"]);
    expect(storedDoc().erp.linkError).toBeUndefined();
  });

  it("the ERP password already is the new утас (an earlier change not recorded): no second change", async () => {
    await firstLoad();
    erp.calls = [];
    await post("SaveHrApplicant", { mobilephone: "88000000" });
    erp.phone = "88000000"; // changed, but our bookkeeping never heard back
    await flushAfter();
    expect(erp.endpoints().slice(0, 2)).toEqual(["auth/login", "auth/login"]);
    expect(erp.endpoints()).not.toContain("changeUserInfo");
    expect(storedDoc().erp).toMatchObject({ loginPhone: "88000000" });
    expect(storedDoc().erp.linkError).toBeUndefined();
  });

  it("neither the old nor the new утас logs in: the refusal is shown and calls stop", async () => {
    await firstLoad();
    erp.calls = [];
    erp.phone = "77000000"; // changed on the old site meanwhile
    await post("SaveHrApplicant", { mobilephone: "88000000" });
    await flushAfter();
    expect(erp.endpoints()).toEqual(["auth/login", "auth/login"]);
    expect(erp.endpoints()).not.toContain("SaveHrAppUser");
    expect((await get("get")).body.retdata).toMatchObject({ erplinkerror: MISMATCH, erplinked: true });

    erp.calls = [];
    advance(48 * 60 * 60_000);
    await get("get");
    await flushAfter();
    expect(erp.calls).toEqual([]);

    // The утас the ERP has now: the recorded one is still refused, the new pair logs in.
    await post("SaveHrApplicant", { mobilephone: "77000000" });
    await flushAfter();
    expect(erp.endpoints().slice(0, 2)).toEqual(["auth/login", "auth/login"]);
    expect(storedDoc().erp).toMatchObject({ loginPhone: "77000000" });
    expect((await get("get")).body.retdata).toMatchObject({ erplinkerror: null });
  });

  it("an account linked before the last-good утас was recorded: the stored утас is taken as it", async () => {
    await firstLoad();
    const oldPhone = erp.phone;
    const legacy = storedDoc();
    delete legacy.erp.loginPhone;
    state.sqlite!.prepare("update applicant_account set data_json = ?").run(JSON.stringify(legacy));
    erp.calls = [];

    await post("SaveHrApplicant", { mobilephone: "88000000" });
    await flushAfter();
    expect(erp.endpoints().slice(0, 3)).toEqual(["auth/login", "changeUserInfo", "auth/login"]);
    expect((erp.calls[1].body as Row).oldpassword).toBe(oldPhone);
    expect(erp.phone).toBe("88000000");
  });

  it("a deliberate retry (retrylink) with the same регистр + утас asks the ERP once more", async () => {
    await seedIdentity({ regno: erp.regno, mobilephone: "88000000" });
    await get("get");
    await flushAfter();
    expect(storedDoc().erp.linkError).toBe(MISMATCH);
    await post("SaveHrApplicant", { regno: erp.regno, mobilephone: "88000000", retrylink: true });
    expect(storedDoc().erp).not.toHaveProperty("linkError");
    // The flag is an instruction, not a profile field: never stored, never sent on.
    expect(storedDoc().profile).not.toHaveProperty("retrylink");
    await flushAfter();
    expect(erp.endpoints().filter((e) => e === "SaveHrAppUser")).toHaveLength(2);
    expect(erp.calls.some((c) => JSON.stringify(c.body ?? "").includes("retrylink"))).toBe(false);
    expect(storedDoc().erp.linkError).toBe(MISMATCH); // refused again, stops again
  });

  it("an ordinary profile save carrying the same регистр + утас does NOT lift the refusal", async () => {
    await seedIdentity({ regno: erp.regno, mobilephone: "88000000" });
    await get("get");
    await flushAfter();
    expect(storedDoc().erp.linkError).toBe(MISMATCH);
    erp.calls = [];

    // The profile form echoes regno + mobilephone on every save.
    const saved = await post("SaveHrApplicant", { regno: erp.regno, mobilephone: "88000000", addr2: "шинэ хаяг" });
    expect(saved.body.rettype).toBe(0);
    expect(storedDoc().erp.linkError).toBe(MISMATCH);
    expect(storedDoc().profile.addr2).toBe("шинэ хаяг");
    await flushAfter();
    await get("get");
    await flushAfter();
    expect(erp.calls).toEqual([]);
    // Only `true` counts as a retry.
    await post("SaveHrApplicant", { regno: erp.regno, mobilephone: "88000000", retrylink: "true" });
    expect(storedDoc().erp.linkError).toBe(MISMATCH);
    expect(storedDoc().profile).not.toHaveProperty("retrylink");
  });

  it("a pull never replaces the утас that logged in (the ERP record's mobilephone is the contact number)", async () => {
    // Password (what auth/login compares) ≠ the record's contact number.
    const fake = richErp();
    fake.record.mobilephone = "99887766";
    fake.record.regno = erp.regno.toLowerCase();
    await firstLoad(fake);
    expect(storedDoc().erp.linkedRegno).toBe(erp.regno);
    expect(storedDoc().profile).toMatchObject({ regno: erp.regno, mobilephone: erp.phone });
    // Other pulled fields still arrive.
    expect(storedDoc().profile.addr2).toBe("ERP хаяг");

    // The next (background) pull and the logins after it keep working.
    advance(11 * 60_000);
    await get("get");
    await flushAfter();
    expect(storedDoc().profile.mobilephone).toBe(erp.phone);
    expect(storedDoc().erp.linkError).toBeUndefined();
    expect(erp.endpoints().filter((e) => e === "auth/login")).toHaveLength(2);
    expect(erp.endpoints()).not.toContain("SaveHrAppUser");
  });

  it("losing the registration claim hands the work back without spending an attempt", async () => {
    erp = new FakeErp((e) => {
      e.registered = false;
    });
    vi.stubGlobal("fetch", erp.fetch);
    await get("get");
    await post("SaveHrApplicant", { regno: "АА00000000", mobilephone: "88001122" });
    // Another request holds the claim.
    const held = storedDoc();
    held.erp.registeringAt = new Date(clock).toISOString();
    state.sqlite!.prepare("update applicant_account set data_json = ?").run(JSON.stringify(held));

    await flushAfter();
    expect(erp.endpoints()).toEqual(["auth/login"]);
    const after = storedDoc().erp;
    expect(after.flush).toBeUndefined(); // no attempt counted
    expect(after.profileDirty).toEqual(expect.any(Number)); // still waiting to go
    expect(after.pullFailures).toBeUndefined();
    expect(after.registeringAt).toBe(held.erp.registeringAt); // not ours to clear
  });

  it("blank get → fill identity (ERP on) → the next get pulls: blank never counted as a failure", async () => {
    await get("get");
    await flushAfter();
    expect(erp.calls).toEqual([]);
    expect(storedDoc().erp?.pullFailures).toBeUndefined();

    await post("SaveHrApplicant", { regno: erp.regno, mobilephone: `+976 ${erp.phone.slice(0, 4)}-${erp.phone.slice(4)}` });
    expect(storedDoc().profile.mobilephone).toBe(erp.phone); // stored as its 8 digits
    const r = await get("get");
    expect(r.body.rettype).toBe(0);
    expect(erp.endpoints().slice(0, 2)).toEqual(["auth/login", "get"]);
    expect(storedDoc().erp.pulledAt).toEqual(expect.any(String));
    await flushAfter();
    expect(erp.endpoints()).not.toContain("SaveHrAppUser");
  });

  it("a регистр registered by the flush is locked right away (before any pull)", async () => {
    erp = new FakeErp((e) => {
      e.registered = false;
    });
    vi.stubGlobal("fetch", erp.fetch);
    await get("get"); // blank: nothing sent
    await post("SaveHrApplicant", { regno: " аа00000000 ", mobilephone: "88001122" });
    expect(storedDoc().profile.regno).toBe("АА00000000");
    await flushAfter(); // the mutation sync: 401 → SaveHrAppUser → flush
    expect(erp.endpoints().filter((e) => e === "SaveHrAppUser")).toHaveLength(1);
    const stored = storedDoc();
    expect(stored.erp.linkedRegno).toBe("АА00000000");
    expect(stored.erp.pulledAt).toBeUndefined();

    const r = await post("SaveHrApplicant", { regno: "ББ11111111" });
    expect(r.status).toBe(409);
    expect(r.body.retmsg).toBe(REGNO_LOCKED_MESSAGE);
    expect(storedDoc().profile.regno).toBe("АА00000000");
  });

  it("two requests hitting the 401 at once send ONE SaveHrAppUser", async () => {
    erp = new FakeErp((e) => {
      e.registered = false;
    });
    erp.delayMs = 20;
    vi.stubGlobal("fetch", erp.fetch);
    await get("get");
    await post("SaveHrApplicant", { regno: "АА00000000", mobilephone: "88001122" });
    // The scheduled after() sync and a refreshing client's inline pull, together.
    await Promise.all([flushAfter(), get("get")]);
    await flushAfter();
    expect(erp.endpoints().filter((e) => e === "SaveHrAppUser")).toHaveLength(1);
    expect(storedDoc().erp.linkedRegno).toBe("АА00000000");
  });

  it("blank identity → no ERP call at all", async () => {
    const r = await get("get"); // fresh Clerk account: no регистр or утас
    await flushAfter();
    expect(r.body.rettype).toBe(0);
    expect(erp.calls).toEqual([]);
  });
});

/* --- mock mode ---------------------------------------------------------------- */

describe("mock mode (NEXT_PUBLIC_API_URL unset)", () => {
  it("makes no fetch calls at all, and every endpoint still works on D1", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const spy = vi.fn(erp.fetch);
    vi.stubGlobal("fetch", spy);
    seedCredentials();
    await get("get");
    await post("SaveHrApplicant", { addr2: "x" });
    const created = await post("SaveHrAppEducation", { entryid: 0, schoolname: "S" });
    await post("DeleteHrAppEducation", undefined, `?ENTRYID=${(created.body.retdata as Row).entryid}`);
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await post("deleteAppCV");
    await flushAfter();
    advance(60 * 60_000);
    await get("get");
    await flushAfter();
    expect(spy).not.toHaveBeenCalled();
  });
});

/* --- leaks ----------------------------------------------------------------- */

describe("leaks", () => {
  it("the get response does not expose the sync bookkeeping (doc.erp)", async () => {
    await firstLoad();
    const p = (await get("get")).body.retdata as Row;
    expect(p).not.toHaveProperty("pendingDeletes");
    expect(p).not.toHaveProperty("cvHash");
    expect(JSON.stringify(p)).not.toContain(erp.token);
  });
});
