import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERP_DELETES, FakeErp, type Row } from "@/server/applicant/fake-erp.fixture";

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

/** A fake ERP holding one row in every section, a photo and an application. */
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
    // The live ERP still holds a CV; this site must ignore it.
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
  expect(erp.endpoints(), "SaveHrAppUser must never be called").not.toContain("SaveHrAppUser");
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
  it("imports every section, the profile, the photo and the applications", async () => {
    const r = await firstLoad();
    expect(r.status).toBe(200);
    const p = r.body.retdata as Row;
    // The very first response already carries the ERP profile and photo (inline pull).
    expect(p).toMatchObject({ lastname: "Дорж", firstname: "Бат", addr2: "ERP хаяг", custom1: "ERP custom", regno: erp.regno });
    expect(p).not.toHaveProperty("filename");
    expect(p).not.toHaveProperty("filedata");
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

describe("CV endpoints are gone", () => {
  it("SaveAppCV and deleteAppCV are unknown requests: 404, no ERP call, no D1 file row", async () => {
    await firstLoad();
    erp.calls = [];
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "local.pdf"));
    expect((await post("SaveAppCV", fd)).status).toBe(404);
    expect((await post("deleteAppCV")).status).toBe(404);
    await flushAfter();
    expect(erp.endpoints()).not.toContain("SaveAppCV");
    expect(erp.endpoints()).not.toContain("deleteAppCV");
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
    expect(JSON.stringify(p)).not.toContain(erp.token);
  });
});
