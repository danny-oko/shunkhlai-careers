import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/me against a REAL SQLite engine (node:sqlite, in memory) driven through
 * drizzle's sqlite-proxy — the same driver shape as src/lib/db/index.ts — with
 * the tables created from the committed drizzle/*.sql migrations. So every
 * assertion below is about rows actually written, not a hand-rolled fake.
 */

// node:sqlite ships with Node 22 but @types/node@20 has no declarations for it.
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDb;
};

const state = vi.hoisted(() => {
  // Reference lookups must hit the bundled mock data, never the live ERP.
  delete process.env.NEXT_PUBLIC_API_URL;
  return {
    sqlite: null as null | {
      exec(sql: string): void;
      prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
    },
    users: new Map<string, { firstName: string; lastName: string; email: string | null }>(),
    userId: null as string | null,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: state.userId }),
  currentUser: async () => {
    if (!state.userId) return null;
    const u = state.users.get(state.userId);
    if (!u) return null;
    const addr = u.email ? { emailAddress: u.email } : null;
    return {
      id: state.userId,
      firstName: u.firstName,
      lastName: u.lastName,
      primaryEmailAddress: addr,
      emailAddresses: addr ? [addr] : [],
    };
  },
}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { drizzle } = await import("drizzle-orm/sqlite-proxy");
  const db = drizzle(
    async (sql, params, method) => {
      const stmt = state.sqlite!.prepare(sql);
      const rows = (stmt.all(...params) as Record<string, unknown>[]).map((r) =>
        Object.values(r),
      );
      return { rows: method === "get" ? (rows[0] ?? []) : rows };
    },
    { schema },
  );
  return { ...schema, schema, getDb: () => db };
});

import { GET, POST } from "./[...path]/route";

/* --- helpers ------------------------------------------------------------ */

function freshDb() {
  state.sqlite = new DatabaseSync(":memory:");
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) state.sqlite!.exec(stmt);
    }
  }
}

function as(userId: string | null, email: string | null = `${userId}@example.mn`, name = ["Бат", "Дорж"]) {
  state.userId = userId;
  if (userId) state.users.set(userId, { firstName: name[0], lastName: name[1], email });
}

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

const rows = (sql: string, ...p: unknown[]) =>
  state.sqlite!.prepare(sql).all(...p) as Record<string, unknown>[];

const profileOf = async () => (await get("get")).body.retdata as Record<string, unknown>;

beforeEach(async () => {
  state.users.clear();
  state.userId = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  freshDb();
});

/* --- auth --------------------------------------------------------------- */

describe("auth", () => {
  it("signed out → 401 envelope on GET and POST, and nothing is written", async () => {
    as(null);
    for (const r of [await get("get"), await post("SaveHrApplicant", { addr2: "x" })]) {
      expect(r.status).toBe(401);
      expect(r.body.rettype).not.toBe(0);
      expect(r.body.retmsg).toEqual(expect.any(String));
      expect(r.body.retdata).toBeNull();
    }
    expect(rows("select * from applicant_account")).toEqual([]);
  });

  it("signed in but Clerk has no email → 401, no row", async () => {
    as("u_noemail", null);
    expect((await get("get")).status).toBe(401);
    expect(rows("select * from applicant_account")).toEqual([]);
  });
});

/* --- account creation / identity --------------------------------------- */

describe("account document", () => {
  it("first GET get auto-creates a doc prefilled from Clerk", async () => {
    as("u1", "Bat@Example.MN", ["Бат", "Дорж"]);
    const r = await get("get");
    expect(r.status).toBe(200);
    expect(r.body.rettype).toBe(0);
    const p = r.body.retdata as Record<string, unknown>;
    expect(p.firstname).toBe("Бат");
    expect(p.lastname).toBe("Дорж");
    expect(String(p.email2).toLowerCase()).toBe("bat@example.mn");

    const stored = rows("select email, clerk_user_id from applicant_account");
    expect(stored).toEqual([{ email: "bat@example.mn", clerk_user_id: "u1" }]);

    // A second GET does not create another row.
    await get("get");
    expect(rows("select * from applicant_account")).toHaveLength(1);
  });

  it("email is case-insensitive: Foo@X.com and foo@x.com share one doc", async () => {
    as("u1", "Foo@X.com");
    await post("SaveHrApplicant", { addr2: "Улаанбаатар, 1-р хороо" });
    as("u1", "foo@x.com");
    expect((await profileOf()).addr2).toBe("Улаанбаатар, 1-р хороо");
    as("u1", "  FOO@x.COM ");
    expect((await profileOf()).addr2).toBe("Улаанбаатар, 1-р хороо");
    expect(rows("select email from applicant_account")).toEqual([{ email: "foo@x.com" }]);
  });

  it("isolation: user B never sees user A's data", async () => {
    as("uA", "a@x.mn");
    await post("SaveHrApplicant", { addr2: "A-гийн хаяг", regno: "АА00000001" });
    await post("SaveHrAppEducation", { entryid: 0, schoolname: "A school" });
    await post("SaveAppFamily", [{ entryid: 0, firstname: "A-relative" }]);
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    const cv = new FormData();
    cv.set("file", new File([new Uint8Array([1, 2, 3])], "a-cv.pdf"));
    await post("SaveAppCV", cv);

    as("uB", "b@x.mn");
    const p = await profileOf();
    expect(p.addr2).not.toBe("A-гийн хаяг");
    expect(p.regno).not.toBe("АА00000001");
    expect(p.filename).toBeNull();
    expect(p.filedata).toBeNull();
    const edu = (await get("GetHrAppEducationData")).body.retdata as Record<string, unknown[]>;
    expect(edu.hrappedulist).toEqual([]);
    const fam = (await get("GetHrAppFamilyData")).body.retdata as Record<string, unknown[]>;
    expect(fam.hrappfamilylist).toEqual([]);
    expect((await get("getRecruitmenRequestList")).body.retdata).toEqual([]);

    // B cannot delete A's row by guessing its entryid.
    as("uA", "a@x.mn");
    const aEdu = ((await get("GetHrAppEducationData")).body.retdata as Record<string, Array<{ entryid: number }>>)
      .hrappedulist[0];
    as("uB", "b@x.mn");
    const del = await post("DeleteHrAppEducation", undefined, `?entryid=${aEdu.entryid}`);
    expect(del.body.rettype).not.toBe(0);
    as("uA", "a@x.mn");
    const still = (await get("GetHrAppEducationData")).body.retdata as Record<string, unknown[]>;
    expect(still.hrappedulist).toHaveLength(1);
  });
});

/* --- profile persistence ----------------------------------------------- */

describe("profile", () => {
  it("parallel saves do not overwrite each other (optimistic lock + retry)", async () => {
    as("u1");
    await get("get"); // create the row first
    await Promise.all([
      post("SaveHrApplicant", { addr2: "Хан-Уул" }),
      post("SaveHrApplicant", { email2: "second@example.mn" }),
      post("SaveHrApplicant", { lastname: "Шинэ" }),
    ]);
    const stored = JSON.parse(String(rows("select data_json from applicant_account")[0].data_json));
    expect(stored.profile).toMatchObject({ addr2: "Хан-Уул", email2: "second@example.mn", lastname: "Шинэ" });
  });

  it("SaveHrApplicant persists to D1 and survives a fresh request", async () => {
    as("u1");
    const saved = await post("SaveHrApplicant", {
      lastname: "Шинэ",
      firstname: "Нэр",
      regno: "УБ99010101",
      mobilephone: "99112233",
      addr2: "Хан-Уул",
    });
    expect(saved.status).toBe(200);
    expect(saved.body.rettype).toBe(0);

    // Proven in the DB row itself, not just in memory.
    const [row] = rows("select data_json from applicant_account");
    const stored = JSON.parse(String(row.data_json));
    expect(stored.profile).toMatchObject({ regno: "УБ99010101", addr2: "Хан-Уул", lastname: "Шинэ" });

    const p = await profileOf();
    expect(p).toMatchObject({ regno: "УБ99010101", mobilephone: "99112233", addr2: "Хан-Уул" });
  });

  it("a later partial save merges over, not replaces, the profile", async () => {
    as("u1");
    await post("SaveHrApplicant", { regno: "УБ99010101", addr2: "old" });
    await post("SaveHrApplicant", { addr2: "new" });
    expect(await profileOf()).toMatchObject({ regno: "УБ99010101", addr2: "new" });
  });
});

/* --- section round trips ----------------------------------------------- */

type Section = {
  name: string;
  save: string;
  body: (entryid: number) => unknown;
  list: () => Promise<Array<Record<string, unknown>>>;
  del: string;
  marker: string;
};

const listOf = (endpoint: string, key?: string) => async () => {
  const data = (await get(endpoint)).body.retdata as Record<string, unknown>;
  return (key ? data[key] : data) as Array<Record<string, unknown>>;
};

const sections: Section[] = [
  { name: "education", save: "SaveHrAppEducation", body: (id) => ({ entryid: id, schoolname: "MUST" }), list: listOf("GetHrAppEducationData", "hrappedulist"), del: "DeleteHrAppEducation", marker: "schoolname" },
  { name: "language", save: "SaveAppForLanguage", body: (id) => ({ entryid: id, forlanguageid: 1, note: "MUST" }), list: listOf("GetHrAppEducationData", "hrapplanglist"), del: "DeleteAppForLanguage", marker: "note" },
  { name: "skill", save: "SaveAppSkillComp", body: (id) => [{ entryid: id, skillcompid: 1, note: "MUST" }], list: listOf("GetHrAppEducationData", "hrappcomplist"), del: "DeleteAppSkillComp", marker: "note" },
  { name: "experience", save: "SaveAppExperience", body: (id) => ({ entryid: id, companyname: "MUST" }), list: listOf("GetHrAppExperienceData", "hrappexplist"), del: "DeleteAppExperience", marker: "companyname" },
  { name: "family", save: "SaveAppFamily", body: (id) => [{ entryid: id, firstname: "MUST" }], list: listOf("GetHrAppFamilyData", "hrappfamilylist"), del: "DeleteAppFamily", marker: "firstname" },
  { name: "interests", save: "SaveInterestedJobItem", body: (id) => ({ entryid: id, posgroupid: 142, note: "MUST" }), list: listOf("getInterestedJobsList"), del: "deleteInterestedJob", marker: "note" },
];

describe.each(sections)("section $name", (s) => {
  it("save → list shows it → update in place → delete → gone (all via D1)", async () => {
    as("u1");
    const created = await post(s.save, s.body(0));
    expect(created.body.rettype).toBe(0);

    let list = await s.list();
    expect(list).toHaveLength(1);
    expect(list[0][s.marker]).toBe("MUST");
    const entryid = Number(list[0].entryid);
    expect(entryid).toBeGreaterThan(0);

    // Row actually lives in the stored JSON.
    expect(String(rows("select data_json from applicant_account")[0].data_json)).toContain("MUST");

    // Update keeps the id and doesn't duplicate.
    const upd = s.body(entryid) as Record<string, unknown> | Record<string, unknown>[];
    const first = Array.isArray(upd) ? upd[0] : upd;
    first[s.marker] = "EDITED";
    await post(s.save, upd);
    list = await s.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ entryid, [s.marker]: "EDITED" });

    // Second insert gets a distinct id (nextEntryId persisted between requests).
    await post(s.save, s.body(0));
    list = await s.list();
    expect(list).toHaveLength(2);
    expect(new Set(list.map((r) => Number(r.entryid))).size).toBe(2);

    const del = await post(s.del, undefined, `?entryid=${entryid}`);
    expect(del.body.rettype).toBe(0);
    list = await s.list();
    expect(list.map((r) => Number(r.entryid))).not.toContain(entryid);
    expect(list).toHaveLength(1);

    // Deleting again is a clean failure envelope, not a 500.
    const again = await post(s.del, undefined, `?entryid=${entryid}`);
    expect(again.status).toBeLessThan(500);
    expect(again.body.rettype).not.toBe(0);
  });
});

/* --- files --------------------------------------------------------------- */

describe("files", () => {
  it("rejects a CV over MAX_CV_BYTES server-side and stores nothing", async () => {
    as("u1");
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" }));
    const res = await post("SaveAppCV", fd);
    expect(res.status).toBe(413);
    expect(res.body.rettype).not.toBe(0);
    expect(rows("select count(*) as n from applicant_file")[0].n).toBe(0);
  });

  it("CV larger than one D1 chunk round-trips byte-exact, then deletes", async () => {
    as("u1");
    const bytes = new Uint8Array(1_200_000).map((_, i) => (i * 31) % 256); // ~1.6 MB base64
    const fd = new FormData();
    fd.set("file", new File([bytes], "cv.pdf", { type: "application/pdf" }));
    expect((await post("SaveAppCV", fd)).body.rettype).toBe(0);

    const chunks = rows("select chunk_index, length(data) as n from applicant_file where kind = 'cv' order by chunk_index");
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(Number(c.n)).toBeLessThan(2_000_000);
    // data_json stays small — the blob is not inlined.
    expect(String(rows("select data_json from applicant_account")[0].data_json).length).toBeLessThan(100_000);

    const p = await profileOf();
    expect(p.filename).toBe("cv.pdf");
    expect(Buffer.from(String(p.filedata), "base64").equals(Buffer.from(bytes))).toBe(true);

    // A non-"get" mutation must not wipe the file (files load only on "get").
    await post("SaveHrApplicant", { addr2: "x" });
    const p2 = await profileOf();
    expect(p2.filename).toBe("cv.pdf");
    expect(String(p2.filedata).length).toBe(String(p.filedata).length);

    expect((await post("deleteAppCV")).body.rettype).toBe(0);
    const p3 = await profileOf();
    expect(p3.filename).toBeNull();
    expect(rows("select * from applicant_file where kind = 'cv'")).toEqual([]);
  });

  it("picture upload is served back as a data URL", async () => {
    as("u1");
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "me.jpg"));
    expect((await post("SaveAppPicture", fd)).body.rettype).toBe(0);
    expect((await profileOf()).picturedata).toBe("data:image/jpeg;base64,/9j/");
  });

  it("upload with no file → failure envelope, nothing stored", async () => {
    as("u1");
    const r = await post("SaveAppCV", new FormData());
    expect(r.body.rettype).not.toBe(0);
    expect(rows("select * from applicant_file")).toEqual([]);
  });
});

/* --- applications ------------------------------------------------------- */

describe("applications", () => {
  it("submit → appears in getRecruitmenRequestList; duplicate refused; DeleteOrderApp removes it", async () => {
    as("u1");
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786, salrequest: 3_000_000 });
    expect(r.body.rettype).toBe(0);

    const list = (await get("getRecruitmenRequestList")).body.retdata as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ recruitmentorderid: 786, posname: "Багаж хариуцсан ажилтан", statusid: 1 });

    const dup = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    expect(dup.body.rettype).not.toBe(0);
    expect((await get("getRecruitmenRequestList")).body.retdata).toHaveLength(1);

    const del = await post("DeleteOrderApp", undefined, `?entryid=${list[0].entryid}`);
    expect(del.body.rettype).toBe(0);
    expect((await get("getRecruitmenRequestList")).body.retdata).toEqual([]);
  });

  it("unknown posting → failure envelope, nothing recorded", async () => {
    as("u1");
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 999_999 });
    expect(r.body.rettype).not.toBe(0);
    expect((await get("getRecruitmenRequestList")).body.retdata).toEqual([]);
  });
});

/* --- legacy import ------------------------------------------------------ */

describe("legacy applicant_profile snapshot", () => {
  it("is imported into a brand-new account", async () => {
    state.sqlite!
      .prepare("insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values (?, ?, ?, ?)")
      .run(
        "p1",
        "u_legacy",
        JSON.stringify({ regno: "УБ88010101", mobilephone: "88112233", addr2: "Legacy addr", picturedata: "AAAA", filedata: "ignored" }),
        Date.now(),
      );
    as("u_legacy", "legacy@x.mn");
    const p = await profileOf();
    expect(p).toMatchObject({ regno: "УБ88010101", mobilephone: "88112233", addr2: "Legacy addr" });
    expect(p.picturedata).toBe("data:image/jpeg;base64,AAAA");
  });

  it("is NOT re-imported over later edits", async () => {
    state.sqlite!
      .prepare("insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values (?, ?, ?, ?)")
      .run("p1", "u_legacy", JSON.stringify({ addr2: "Legacy addr" }), Date.now());
    as("u_legacy", "legacy@x.mn");
    await get("get");
    await post("SaveHrApplicant", { addr2: "Edited" });
    expect((await profileOf()).addr2).toBe("Edited");
  });

  it("does not leak another Clerk user's snapshot", async () => {
    state.sqlite!
      .prepare("insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values (?, ?, ?, ?)")
      .run("p1", "someone_else", JSON.stringify({ regno: "УБ77010101" }), Date.now());
    as("u1");
    expect((await profileOf()).regno).not.toBe("УБ77010101");
  });
});

/* --- unknown endpoints -------------------------------------------------- */

describe("unknown endpoint", () => {
  it("GET and POST return a sane error envelope (4xx, rettype≠0, message), no write", async () => {
    as("u1");
    for (const r of [await get("NoSuchThing"), await post("NoSuchThing", { a: 1 })]) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(r.body.rettype).not.toBe(0);
      expect(r.body.retmsg).toEqual(expect.any(String));
      expect(r.body.retdata).toBeNull();
    }
  });

  it("does not serve the mock's sign-in or password endpoints", async () => {
    as("u1");
    const r = await post("SaveHrAppUser", { regno: "АА00000000", mobilephone: "99119911", lastname: "x", firstname: "y" });
    expect(r.body.rettype).not.toBe(0);
    const c = await post("changeUserInfo", { type: "PASSWORD", oldpassword: "", newpassword: "123456" });
    expect(c.body.rettype).not.toBe(0);
  });
});
