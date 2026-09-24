import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * /api/me against a REAL PostgreSQL engine — PGlite, Postgres compiled to
 * WASM, in this process — driven through drizzle, with the tables created from
 * the committed drizzle/*.sql migration. So every assertion below is about
 * rows actually written, not a hand-rolled fake, and it is the same schema the
 * customer's server gets. Nothing here reaches a network.
 */

const state = vi.hoisted(() => {
  // Reference lookups must hit the bundled mock data, never the live ERP.
  delete process.env.NEXT_PUBLIC_API_URL;
  return {
    pg: null as TestDatabase | null,
    users: new Map<string, { firstName: string; lastName: string; email: string | null }>(),
    userId: null as string | null,
    // Callbacks handed to next/server `after()`; run them with flushAfter().
    after: [] as Array<() => unknown>,
  };
});

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: unknown) => {
    state.after.push(typeof task === "function" ? (task as () => unknown) : () => task);
  },
}));

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
  const { createTestDatabase } = await import("@/lib/db/testing");
  state.pg = await createTestDatabase();
  return { ...schema, schema, getDb: () => state.pg!.db };
});

import { GET, POST } from "./[...path]/route";

/* --- helpers ------------------------------------------------------------ */

/** Empty tables per case: building Postgres once and truncating is far cheaper. */
async function freshDb() {
  await state.pg!.reset();
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

const rows = async (sql: string, p: unknown[] = []) =>
  (await state.pg!.client.query<Record<string, unknown>>(sql, p)).rows;

const profileOf = async () => (await get("get")).body.retdata as Record<string, unknown>;

/** GET /api/me/cv: the raw response (a file, or the failure envelope). */
const download = () => GET(new Request("http://x/api/me/cv"), ctx("cv") as never);

/** Every write but SaveHrApplicant needs регистр + утас stored (names come from Clerk). */
const IDENTITY = { regno: "УБ99010101", mobilephone: "99112233" };
const ready = () => post("SaveHrApplicant", IDENTITY);

beforeEach(async () => {
  state.users.clear();
  state.userId = null;
  state.after = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  await freshDb();
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
    expect((await rows("select * from applicant_account"))).toEqual([]);
  });

  it("signed in but Clerk has no email → 401, no row", async () => {
    as("u_noemail", null);
    expect((await get("get")).status).toBe(401);
    expect((await rows("select * from applicant_account"))).toEqual([]);
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

    const stored = (await rows("select email, clerk_user_id from applicant_account"));
    expect(stored).toEqual([{ email: "bat@example.mn", clerk_user_id: "u1" }]);

    // A second GET does not create another row.
    await get("get");
    expect((await rows("select * from applicant_account"))).toHaveLength(1);
  });

  it("saves a row whose updated_at carries microseconds", async () => {
    as("u1", "micro@x.mn");
    await post("SaveHrApplicant", { ...IDENTITY, addr2: "Эхний хаяг" });

    // What `now()` writes, and what any hand-run SQL or a future import script
    // would write. A JavaScript Date cannot hold the last three digits, so the
    // version this code reads back is already rounded; comparing it against
    // the column as stored matched nothing, and every later save of the row
    // failed as a conflict that no retry could clear.
    await rows(
      "update applicant_account set updated_at = updated_at + interval '456 microseconds' where email = $1",
      ["micro@x.mn"],
    );
    const [before] = await rows("select updated_at from applicant_account where email = $1", [
      "micro@x.mn",
    ]);
    expect(String(before.updated_at)).not.toMatch(/000$/);

    await post("SaveHrApplicant", { ...IDENTITY, addr2: "Шинэ хаяг" });
    expect((await profileOf()).addr2).toBe("Шинэ хаяг");
  });

  it("email is case-insensitive: Foo@X.com and foo@x.com share one doc", async () => {
    as("u1", "Foo@X.com");
    await post("SaveHrApplicant", { ...IDENTITY, addr2: "Улаанбаатар, 1-р хороо" });
    as("u1", "foo@x.com");
    expect((await profileOf()).addr2).toBe("Улаанбаатар, 1-р хороо");
    as("u1", "  FOO@x.COM ");
    expect((await profileOf()).addr2).toBe("Улаанбаатар, 1-р хороо");
    expect((await rows("select email from applicant_account"))).toEqual([{ email: "foo@x.com" }]);
  });

  it("isolation: user B never sees user A's data", async () => {
    as("uA", "a@x.mn");
    await post("SaveHrApplicant", { addr2: "A-гийн хаяг", regno: "АА00000001", mobilephone: "99001100" });
    await post("SaveHrAppEducation", { entryid: 0, universitynametext: "A school" });
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
    expect(p).not.toHaveProperty("filedata");
    expect((await download()).status).toBe(404);
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
    await ready(); // create the row first
    await Promise.all([
      post("SaveHrApplicant", { addr2: "Хан-Уул" }),
      post("SaveHrApplicant", { email2: "second@example.mn" }),
      post("SaveHrApplicant", { lastname: "Шинэ" }),
    ]);
    const stored = JSON.parse(String((await rows("select data_json from applicant_account"))[0].data_json));
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
    const [row] = (await rows("select data_json from applicant_account"));
    const stored = JSON.parse(String(row.data_json));
    expect(stored.profile).toMatchObject({ regno: "УБ99010101", addr2: "Хан-Уул", lastname: "Шинэ" });

    const p = await profileOf();
    expect(p).toMatchObject({ regno: "УБ99010101", mobilephone: "99112233", addr2: "Хан-Уул" });
  });

  it("a later partial save merges over, not replaces, the profile", async () => {
    as("u1");
    await post("SaveHrApplicant", { ...IDENTITY, addr2: "old" });
    await post("SaveHrApplicant", { addr2: "new" });
    expect(await profileOf()).toMatchObject({ regno: "УБ99010101", addr2: "new" });
  });
});

/* --- identity gate ----------------------------------------------------- */

describe("identity gate (регистр, овог, нэр, утас before any write)", () => {
  const stored = async () =>
    JSON.parse(String((await rows("select data_json from applicant_account"))[0].data_json));

  it("refuses every other POST while регистр/утас are blank: 409, Mongolian retmsg, no D1 write", async () => {
    as("u1");
    await get("get");
    const before = (await stored());
    const cv = new FormData();
    cv.set("file", new File([new Uint8Array([1, 2, 3])], "cv.pdf"));
    const attempts = [
      await post("SaveHrAppEducation", { entryid: 0, universitynametext: "X" }),
      await post("SaveAppFamily", [{ entryid: 0, firstname: "X" }]),
      await post("SaveInterestedJobItem", { entryid: 0, posgroupid: 142 }),
      await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 }),
      await post("DeleteOrderApp", undefined, "?entryID=1"),
      await post("SaveAppCV", cv),
      await post("deleteAppCV"),
    ];
    for (const r of attempts) {
      expect(r.status).toBe(409);
      expect(r.body.rettype).not.toBe(0);
      expect(r.body.retmsg).toBe("Эхлээд регистр, овог, нэр, утасны дугаараа бөглөнө үү.");
      expect(r.body.retdata).toBeNull();
    }
    expect((await stored())).toEqual(before);
    expect((await rows("select * from applicant_file"))).toEqual([]);
  });

  it("SaveHrApplicant must leave all four filled, judged on the merge with what is stored", async () => {
    as("u1", "u1@example.mn", ["", ""]); // Clerk without a name
    for (const body of [
      { addr2: "x" },
      { regno: "УБ99010101", mobilephone: "99112233" }, // names still blank
      { regno: "УБ99010101", mobilephone: "99112233", lastname: "Дорж", firstname: "  " },
    ]) {
      const r = await post("SaveHrApplicant", body);
      expect(r.status).toBe(409);
      expect(r.body.rettype).not.toBe(0);
    }
    expect((await stored()).profile).toMatchObject({ regno: "", mobilephone: "", addr2: "" });

    const ok = await post("SaveHrApplicant", { lastname: "Дорж", firstname: "Бат", ...IDENTITY });
    expect(ok.body.rettype).toBe(0);
    // A partial body (the client drops blank regno/phone) merges over the stored four.
    expect((await post("SaveHrApplicant", { addr2: "Хан-Уул" })).body.rettype).toBe(0);
    // Blanking one of them is refused.
    expect((await post("SaveHrApplicant", { lastname: "" })).status).toBe(409);
    expect((await stored()).profile).toMatchObject({ lastname: "Дорж", addr2: "Хан-Уул" });
    // …and the other writes now go through.
    expect((await post("SaveHrAppEducation", { entryid: 0, universitynametext: "X" })).body.rettype).toBe(0);
  });

  it("get tells the client whether the регистр is linked to an ERP record", async () => {
    as("u1");
    expect(await profileOf()).toMatchObject({ erplinked: false, erplinkerror: null });
  });

  it("an unchanged регистр / утас in another spelling keeps the stored value", async () => {
    await rows(
      "insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values ($1, $2, $3, $4)",
      ["p1", "u1", JSON.stringify({ regno: "УБ99010101", mobilephone: "9911-2233" }), new Date()],
    );
    as("u1");
    await post("SaveHrApplicant", { regno: "уб99010101", mobilephone: "9911-2233", addr2: "x" });
    await post("SaveHrApplicant", { mobilephone: "9911 2233" });
    expect((await stored()).profile).toMatchObject({ regno: "УБ99010101", mobilephone: "9911-2233", addr2: "x" });
    await post("SaveHrApplicant", { mobilephone: "8811 2233" }); // a new number is normalised
    expect((await stored()).profile.mobilephone).toBe("88112233");
  });

  it("SaveHrApplicant stores регистр upper-cased and the phone as its 8 digits", async () => {
    as("u1");
    await post("SaveHrApplicant", { regno: " уб99010101 ", mobilephone: "+976 9911-2233" });
    expect((await stored()).profile).toMatchObject({ regno: "УБ99010101", mobilephone: "99112233" });
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

/** Each interest body names another position: the same group + position twice is refused. */
let interestSeq = 3700;

const sections: Section[] = [
  { name: "education", save: "SaveHrAppEducation", body: (id) => ({ entryid: id, universitynametext: "MUST" }), list: listOf("GetHrAppEducationData", "hrappedulist"), del: "DeleteHrAppEducation", marker: "universitynametext" },
  { name: "language", save: "SaveAppForLanguage", body: (id) => ({ entryid: id, forlanguageid: 1, note: "MUST" }), list: listOf("GetHrAppEducationData", "hrapplanglist"), del: "DeleteAppForLanguage", marker: "note" },
  { name: "skill", save: "SaveAppSkillComp", body: (id) => [{ entryid: id, skillcompid: 1, note: "MUST" }], list: listOf("GetHrAppEducationData", "hrappcomplist"), del: "DeleteAppSkillComp", marker: "note" },
  { name: "experience", save: "SaveAppExperience", body: (id) => ({ entryid: id, orgname: "Шунхлай", jobid: 100, companyname: "MUST" }), list: listOf("GetHrAppExperienceData", "hrappexplist"), del: "DeleteAppExperience", marker: "companyname" },
  { name: "family", save: "SaveAppFamily", body: (id) => [{ entryid: id, relativeid: 1, firstname: "MUST" }], list: listOf("GetHrAppFamilyData", "hrappfamilylist"), del: "DeleteAppFamily", marker: "firstname" },
  { name: "interests", save: "SaveInterestedJobItem", body: (id) => ({ entryid: id, posgroupid: 142, positionid: (interestSeq += 1), note: "MUST" }), list: listOf("getInterestedJobsList"), del: "deleteInterestedJob", marker: "note" },
];

describe.each(sections)("section $name", (s) => {
  it("save → list shows it → update in place → delete → gone (all via D1)", async () => {
    as("u1");
    await ready();
    const created = await post(s.save, s.body(0));
    expect(created.body.rettype).toBe(0);

    let list = await s.list();
    expect(list).toHaveLength(1);
    expect(list[0][s.marker]).toBe("MUST");
    const entryid = Number(list[0].entryid);
    expect(entryid).toBeGreaterThan(0);

    // Row actually lives in the stored JSON.
    expect(String((await rows("select data_json from applicant_account"))[0].data_json)).toContain("MUST");

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
    expect((await rows("select count(*) as n from applicant_file"))[0].n).toBe(0);
  });

  it("a multi-megabyte CV round-trips byte-exact, then deletes", async () => {
    as("u1");
    await ready();
    const bytes = new Uint8Array(1_200_000).map((_, i) => (i * 31) % 256); // ~1.6 MB base64
    const fd = new FormData();
    fd.set("file", new File([bytes], "cv.pdf", { type: "application/pdf" }));
    expect((await post("SaveAppCV", fd)).body.rettype).toBe(0);

    // The bytes are a file now: nothing of them is in the database, and the
    // row that replaced the chunks holds only the metadata. That is the whole
    // point of the move — a 5 MB CV no longer costs 6.7 MB of base64 in
    // Postgres and another copy in Node's heap on every read.
    expect(Number((await rows("select count(*) as n from applicant_file"))[0].n)).toBe(0);
    const stored = await rows(
      "select sha256, content_type, byte_size, filename from stored_file where owner_kind = 'applicant_cv'",
    );
    expect(stored).toHaveLength(1);
    expect(Number(stored[0].byte_size)).toBe(bytes.byteLength);
    expect(stored[0].content_type).toBe("application/pdf");
    expect(stored[0].filename).toBe("cv.pdf");
    // data_json stays small — the blob is not inlined.
    expect(String((await rows("select data_json from applicant_account"))[0].data_json).length).toBeLessThan(100_000);

    const p = await profileOf();
    expect(p.filename).toBe("cv.pdf");
    // `get` stays light: the name only; the bytes come from GET /api/me/cv.
    expect(p).not.toHaveProperty("filedata");
    const res = await download();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain('filename="cv.pdf"');
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);

    // A non-"get" mutation must not wipe the file (it is never loaded into the doc).
    await post("SaveHrApplicant", { addr2: "x" });
    expect((await profileOf()).filename).toBe("cv.pdf");
    expect(Buffer.from(await (await download()).arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);

    expect((await post("deleteAppCV")).body.rettype).toBe(0);
    const p3 = await profileOf();
    expect(p3.filename).toBeNull();
    expect((await rows("select * from applicant_file where kind = 'cv'"))).toEqual([]);
    const gone = await download();
    expect(gone.status).toBe(404);
    expect(((await gone.json()) as Env).retmsg).toBe("CV хавсаргаагүй байна.");
  });

  it("re-uploading replaces the CV; the download keeps a Cyrillic name and the Word MIME type", async () => {
    as("u1");
    await ready();
    const first = new FormData();
    first.set("file", new File([new Uint8Array([1])], "old.pdf"));
    await post("SaveAppCV", first);
    const second = new FormData();
    second.set("file", new File([new Uint8Array([7, 8, 9])], "Анкет Бат.docx"));
    expect((await post("SaveAppCV", second)).body.rettype).toBe(0);

    expect((await profileOf()).filename).toBe("Анкет Бат.docx");
    const res = await download();
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="_____ ___.docx"; filename*=UTF-8''${encodeURIComponent("Анкет Бат.docx")}`,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([7, 8, 9]);
  });

  it("the download is the signed-in applicant's own: 401 signed out, 404 for another user", async () => {
    as("uA", "a@x.mn");
    await post("SaveHrApplicant", { regno: "АА00000001", mobilephone: "99001100" });
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "a.pdf"));
    await post("SaveAppCV", fd);
    expect((await download()).status).toBe(200);

    as(null);
    expect((await download()).status).toBe(401);
    as("uB", "b@x.mn");
    expect((await download()).status).toBe(404);
  });

  it("picture upload is served back as a data URL", async () => {
    as("u1");
    await ready();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "me.jpg"));
    expect((await post("SaveAppPicture", fd)).body.rettype).toBe(0);
    expect((await profileOf()).picturedata).toBe("data:image/jpeg;base64,/9j/");
  });

  it("refuses a CV that is not PDF/DOC/DOCX by extension or reported type: Mongolian retmsg, nothing stored", async () => {
    as("u1");
    await ready();
    const before = String((await rows("select data_json from applicant_account"))[0].data_json);
    for (const file of [
      new File([new Uint8Array([1])], "cv.exe"),
      new File([new Uint8Array([1])], "cv", { type: "application/pdf" }), // no extension
      new File([new Uint8Array([1])], "cv.pdf", { type: "text/html" }), // lying extension
      new File([new Uint8Array([1])], "photo.png", { type: "image/png" }),
    ]) {
      const fd = new FormData();
      fd.set("file", file);
      const r = await post("SaveAppCV", fd);
      expect(r.status, file.name).toBe(415);
      expect(r.body.rettype).not.toBe(0);
      expect(r.body.retmsg).toBe("PDF, DOC эсвэл DOCX файл оруулна уу.");
    }
    expect((await rows("select * from applicant_file"))).toEqual([]);
    expect(String((await rows("select data_json from applicant_account"))[0].data_json)).toBe(before);
    expect((await profileOf()).filename).toBeNull();

    // An unknown type (octet-stream, or none) with an accepted extension is fine.
    const ok = new FormData();
    ok.set("file", new File([new Uint8Array([1])], "CV.DOCX", { type: "application/octet-stream" }));
    expect((await post("SaveAppCV", ok)).body.rettype).toBe(0);
  });

  it("refuses a photo that is not JPEG/PNG/WebP by type or first bytes; nothing stored", async () => {
    as("u1");
    await ready();
    for (const file of [
      new File([new TextEncoder().encode("<svg/>")], "me.jpg"), // bytes are not an image
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "me.gif", { type: "image/gif" }),
      new File([new TextEncoder().encode("%PDF-1.4")], "me.png", { type: "image/png" }),
    ]) {
      const fd = new FormData();
      fd.set("file", file);
      const r = await post("SaveAppPicture", fd);
      expect(r.status, file.name).toBe(415);
      expect(r.body.retmsg).toBe("Зураг оруулна уу (JPG, PNG).");
    }
    expect((await rows("select * from applicant_file"))).toEqual([]);
    expect((await profileOf()).picturedata ?? null).toBeNull();

    const png = new FormData();
    png.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], "me.png", { type: "image/png" }));
    expect((await post("SaveAppPicture", png)).body.rettype).toBe(0);
  });

  it("upload with no file → failure envelope, nothing stored", async () => {
    as("u1");
    await ready();
    const r = await post("SaveAppCV", new FormData());
    expect(r.body.rettype).not.toBe(0);
    expect((await rows("select * from applicant_file"))).toEqual([]);
  });
});

/* --- applications ------------------------------------------------------- */

describe("applications", () => {
  it("submit → appears in getRecruitmenRequestList; duplicate refused; DeleteOrderApp removes it", async () => {
    as("u1");
    await ready();
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
    await ready();
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 999_999 });
    expect(r.body.rettype).not.toBe(0);
    expect((await get("getRecruitmenRequestList")).body.retdata).toEqual([]);
  });
});

/* --- legacy import ------------------------------------------------------ */

describe("legacy applicant_profile snapshot", () => {
  it("is imported into a brand-new account", async () => {
    await rows(
      "insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values ($1, $2, $3, $4)",
      [
        "p1",
        "u_legacy",
        JSON.stringify({ regno: "УБ88010101", mobilephone: "88112233", addr2: "Legacy addr", picturedata: "AAAA", filedata: "ignored" }),
        new Date(),
      ],
    );
    as("u_legacy", "legacy@x.mn");
    const p = await profileOf();
    expect(p).toMatchObject({ regno: "УБ88010101", mobilephone: "88112233", addr2: "Legacy addr" });
    expect(p.picturedata).toBe("data:image/jpeg;base64,AAAA");
  });

  it("is NOT re-imported over later edits", async () => {
    await rows(
      "insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values ($1, $2, $3, $4)",
      ["p1", "u_legacy", JSON.stringify({ addr2: "Legacy addr" }), new Date()],
    );
    as("u_legacy", "legacy@x.mn");
    await get("get");
    await post("SaveHrApplicant", { ...IDENTITY, addr2: "Edited" });
    expect((await profileOf()).addr2).toBe("Edited");
  });

  it("does not leak another Clerk user's snapshot", async () => {
    await rows(
      "insert into applicant_profile (id, clerk_user_id, data_json, synced_at) values ($1, $2, $3, $4)",
      ["p1", "someone_else", JSON.stringify({ regno: "УБ77010101" }), new Date()],
    );
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

/* --- ERP push (after()) -------------------------------------------------- */

async function flushAfter() {
  while (state.after.length) await state.after.shift()!();
}

describe("ERP push via after()", () => {
  const REGNO = "УБ99010101";
  const PHONE = "99112233";
  const TOKEN = "tok-ROUTE-SECRET";
  type ErpCall = { endpoint: string; query: string; body: unknown };
  let erpCalls: ErpCall[];
  let erpMode: "ok" | "down";
  let logs: string[];

  beforeEach(() => {
    erpCalls = [];
    erpMode = "ok";
    logs = [];
    // Only the push reads this at call time; reference data stays on the mock.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const endpoint = url.pathname.replace(/^\/api\/applicant\//, "");
        const raw = init?.body;
        erpCalls.push({ endpoint, query: url.search, body: typeof raw === "string" ? JSON.parse(raw) : null });
        if (erpMode === "down") throw new TypeError("fetch failed");
        const env = (retdata: unknown) => new Response(JSON.stringify({ rettype: 0, retmsg: "", retdata }));
        switch (endpoint) {
          case "auth/login":
            return new Response(JSON.stringify({ access_token: TOKEN }));
          case "get":
            return env({ applicantdata: [{ regno: REGNO, mobilephone: PHONE, addr2: "ERP" }] });
          case "getRecruitmenRequestList":
            return env([{ entryid: 4242, recruitmentorderid: 786 }]);
          default:
            return env(true);
        }
      }),
    );
    const capture = (...a: unknown[]) => logs.push(a.map((x) => (x instanceof Error ? `${x.message} ${x.stack}` : String(x))).join(" "));
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
  });

  const erpOf = async () => {
    const [row] = (await get("getRecruitmenRequestList")).body.retdata as Array<Record<string, unknown>>;
    return row?.erp as Record<string, unknown> | undefined;
  };

  async function ready() {
    as("u1");
    await post("SaveHrApplicant", { regno: REGNO, mobilephone: PHONE });
  }

  it("submit replies before any ERP call, saves pending, then after() marks it sent with the ERP id", async () => {
    await ready();
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    expect(r.status).toBe(200);
    expect(r.body.rettype).toBe(0);
    expect(erpCalls).toEqual([]); // nothing on the request path
    expect(state.after).toHaveLength(1);
    expect((await erpOf())?.status).toBe("pending");

    await flushAfter();
    expect(erpCalls.map((c) => c.endpoint)).toEqual([
      "auth/login",
      "get",
      "SaveHrApplicant",
      "SaveHrRecruitmentOrderApp",
      "getRecruitmenRequestList",
    ]);
    expect(await erpOf()).toMatchObject({ status: "sent", erpEntryId: 4242 });
  });

  it("ERP down: D1 row saved, response rettype 0, erp status failed, after() does not throw", async () => {
    await ready();
    erpMode = "down";
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    expect(r.body.rettype).toBe(0);
    await expect(flushAfter()).resolves.toBeUndefined();
    const list = (await get("getRecruitmenRequestList")).body.retdata as unknown[];
    expect(list).toHaveLength(1);
    expect((await erpOf())?.status).toBe("failed");
  });

  it("a later get retries a due failed row (failed → sent) and the attempts cap holds", async () => {
    await ready();
    erpMode = "down";
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    expect((await erpOf())?.status).toBe("failed");

    // Not due yet (backoff): get schedules nothing.
    state.after = [];
    await get("get");
    expect(state.after).toHaveLength(0);

    // 11 minutes later the ERP is back: get schedules a retry that succeeds.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    erpMode = "ok";
    await get("get");
    expect(state.after.length).toBeGreaterThan(0);
    await flushAfter();
    expect(await erpOf()).toMatchObject({ status: "sent", erpEntryId: 4242 });
    vi.useRealTimers();
  });

  it("stops retrying after 5 attempts", async () => {
    await ready();
    erpMode = "down";
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    vi.useFakeTimers({ toFake: ["Date"] });
    let now = Date.now();
    for (let i = 0; i < 10; i += 1) {
      now += 60 * 60_000;
      vi.setSystemTime(now);
      await get("get");
      await flushAfter();
    }
    const erp = await erpOf();
    expect(erp?.status).toBe("failed");
    expect(erp?.attempts).toBe(5);
    const logins = erpCalls.filter((c) => c.endpoint === "auth/login").length;
    expect(logins).toBeLessThanOrEqual(5 * 2); // login + login-after-register per attempt
    vi.useRealTimers();
  });

  it("DeleteOrderApp removes the D1 row and cancels in the ERP with erpEntryId", async () => {
    await ready();
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    const [row] = (await get("getRecruitmenRequestList")).body.retdata as Array<Record<string, unknown>>;
    erpCalls = [];
    state.after = [];

    const del = await post("DeleteOrderApp", undefined, `?entryID=${row.entryid}`);
    expect(del.body.rettype).toBe(0);
    expect(erpCalls).toEqual([]); // not on the request path
    await flushAfter();
    const cancel = erpCalls.find((c) => c.endpoint === "DeleteOrderApp");
    expect(cancel).toBeDefined();
    expect(new URLSearchParams(cancel!.query).get("entryID")).toBe("4242");
    expect((await get("getRecruitmenRequestList")).body.retdata).toEqual([]);
  });

  it("no ERP delete for a row that never reached the ERP", async () => {
    await ready();
    erpMode = "down";
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    const [row] = (await get("getRecruitmenRequestList")).body.retdata as Array<Record<string, unknown>>;
    erpMode = "ok";
    erpCalls = [];
    await post("DeleteOrderApp", undefined, `?entryID=${row.entryid}`);
    await flushAfter();
    expect(erpCalls.filter((c) => c.endpoint === "DeleteOrderApp")).toEqual([]);
  });

  it("the applicant's data is never deleted in the ERP by submit/retry/profile saves", async () => {
    await ready();
    await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    await flushAfter();
    await post("SaveHrApplicant", { addr2: "" });
    await get("get");
    await flushAfter();
    expect(erpCalls.filter((c) => /delete/i.test(c.endpoint))).toEqual([]);
  });

  it("API URL unset → submit works, nothing is fetched", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await ready();
    const r = await post("SaveHrRecruitmentOrderApp", { recruitmentorderid: 786 });
    expect(r.body.rettype).toBe(0);
    await flushAfter();
    expect(erpCalls).toEqual([]);
    expect((await erpOf())?.status).toBe("skipped");
  });
});
