import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ApplicantDoc } from "./handlers";
import { CLAIM_TTL_MS } from "./erp-model";
import { MAX_ATTEMPTS, findErpEntryId, isDue, loginFor, profileOverlay, pushApplication } from "./erp-push";

type Call = { endpoint: string; body: unknown; auth: string | null };

const ok = (retdata: unknown) => ({ rettype: 0, retmsg: "", retdata });
const fail = (retmsg: string) => ({ rettype: 1, retmsg, retdata: null });

function doc(profile: Record<string, unknown> = {}): ApplicantDoc {
  return {
    profile: { regno: "АА00000000", mobilephone: "99112233", firstname: "Бат", lastname: "Дорж", ...profile },
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
  };
}

const app = {
  entryid: 1001,
  recruitmentorderid: 55,
  posname: "Нягтлан",
  locname: "Төв",
  salrequest: 3,
  availabledate: "2026-10-01",
  recsourceid: 45,
  sourcetype: "WEB",
};

const deps = (cv: { filename: string; data: string } | null = null) => ({
  identity: { firstname: "Бат", lastname: "Дорж", email: "a@b.mn" },
  loadCv: async () => cv,
});

let calls: Call[];
let answers: Record<string, unknown[]>;
/** HTTP status per endpoint (default 200). */
let statuses: Record<string, number>;

function answer(endpoint: string, ...bodies: unknown[]) {
  answers[endpoint] = bodies;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
  calls = [];
  answers = {};
  statuses = {};
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.replace("/api/applicant/", "");
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw instanceof FormData ? "form" : null;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ endpoint, body, auth: headers.Authorization ?? null });
    const queue = answers[endpoint] ?? [ok(null)];
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify(next), { status: statuses[endpoint] ?? 200 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("pushApplication", () => {
  it("skips in mock mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(await pushApplication(doc(), app, deps())).toEqual({ status: "skipped" });
    expect(calls).toEqual([]);
  });

  it("fails fast without регистр, овог, нэр or утас", async () => {
    for (const key of ["regno", "lastname", "firstname", "mobilephone"]) {
      const result = await pushApplication(doc({ [key]: "" }), app, deps());
      expect(result).toEqual({ status: "failed", error: "profile_incomplete" });
    }
    expect(calls).toEqual([]);
  });

  it("logs in, overlays the profile on the ERP record, applies and finds the entry id", async () => {
    answer("auth/login", { access_token: "tok" });
    answer("get", ok({ applicantdata: [{ lastname: "Дорж", firstname: "Old", addr2: "keep", isb: true }] }));
    answer("getRecruitmenRequestList", ok([{ entryid: 777, recruitmentorderid: 55 }]));

    const edited = doc({ addr2: "" });
    edited.erp = { profileEdited: true }; // the applicant saved their profile here
    const result = await pushApplication(edited, app, deps());

    expect(result).toMatchObject({ status: "sent", erpEntryId: 777, cvHash: undefined });
    expect(calls.map((c) => c.endpoint)).toEqual([
      "auth/login",
      "get",
      "SaveHrApplicant",
      "SaveHrRecruitmentOrderApp",
      "getRecruitmenRequestList",
    ]);
    const profile = calls[2].body as Record<string, unknown>;
    expect(profile).toMatchObject({ lastname: "Дорж", firstname: "Бат", addr2: "keep", isb: true });
    expect(calls[3].body).toEqual({
      recruitmentorderid: 55,
      sourcetype: "WEB",
      salrequest: 3,
      poshiredate: "2026-10-01",
      recsourceid: 45,
    });
    expect(calls.slice(1).every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  // Policy (Postman 01/02): login first; SaveHrAppUser only when the login
  // 401s. On a new регистр it creates the ERP applicant and returns a token; on
  // an existing one with another phone it answers "…зөрж байна!" and changes
  // nothing — so it can never overwrite someone else's record.
  it("a 401 login registers once through SaveHrAppUser and uses its token", async () => {
    statuses["auth/login"] = 401;
    answer("auth/login", { rettype: -1, retmsg: "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!", retdata: null });
    answer("SaveHrAppUser", ok({ access_token: "new-tok" }));
    const result = await pushApplication(doc(), app, deps());
    expect(result.status).toBe("sent");
    expect(calls.slice(0, 3).map((c) => c.endpoint)).toEqual(["auth/login", "SaveHrAppUser", "get"]);
    expect(calls[1]).toMatchObject({
      auth: null,
      body: { lastname: "Дорж", firstname: "Бат", regno: "АА00000000", email: "a@b.mn", mobilephone: "99112233" },
    });
    expect(calls.slice(2).every((c) => c.auth === "Bearer new-tok")).toBe(true);
  });

  it("registering with an existing регистр and another phone: failed, message kept, no retry", async () => {
    const message = "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!";
    statuses["auth/login"] = 401;
    answer("auth/login", { rettype: -1, retmsg: message, retdata: null });
    answer("SaveHrAppUser", fail(message));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const refused = await loginFor(doc());
    expect(refused).toMatchObject({ ok: false, error: "erp_link_mismatch", linkError: message });
    expect(calls.map((c) => c.endpoint)).toEqual(["auth/login", "SaveHrAppUser"]);

    // Stored with its key, the same credentials are never sent again…
    const key = (refused as { linkKey: string }).linkKey;
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    const stored = { ...doc(), erp: { linkError: message, linkKey: key } };
    expect(await loginFor(stored)).toMatchObject({ ok: false, error: "erp_link_refused" });
    expect(calls).toHaveLength(2);
    // …but a changed phone is tried.
    answer("SaveHrAppUser", ok({ access_token: "tok" }));
    const fixed = { ...stored, profile: { ...stored.profile, mobilephone: "88112233" } };
    expect(await loginFor(fixed)).toEqual({ ok: true, value: "tok" });
  });

  it("a 401 on an account already linked is a refusal, never a registration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    statuses["auth/login"] = 401;
    answer("auth/login", { message: "Unauthorized" }); // no retmsg: the standard wording is used
    const linked = { ...doc(), erp: { linkedRegno: "АА00000000" } };
    const claim = vi.fn(async () => true);
    expect(await loginFor(linked, { claimRegister: claim })).toMatchObject({
      ok: false,
      error: "erp_link_mismatch",
      linkError: "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!",
      linkKey: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(claim).not.toHaveBeenCalled();
    expect(calls.map((c) => c.endpoint)).toEqual(["auth/login"]);
  });

  it("only the claim holder sends SaveHrAppUser", async () => {
    statuses["auth/login"] = 401;
    answer("auth/login", { rettype: -1, retmsg: "зөрж байна", retdata: null });
    expect(await loginFor(doc(), { claimRegister: async () => false })).toEqual({ ok: false, error: "erp_register_busy" });
    expect(calls.map((c) => c.endpoint)).toEqual(["auth/login"]);
  });

  it("a login that fails for any other reason (5xx, envelope refusal) never registers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    statuses["auth/login"] = 503;
    answer("auth/login", { message: "down" });
    expect(await loginFor(doc())).toEqual({ ok: false, error: "erp_login_failed" });
    answer("auth/login", fail("зөрж байна"));
    statuses["auth/login"] = 200;
    expect(await loginFor(doc())).toEqual({ ok: false, error: "erp_login_failed" });
    expect(calls.map((c) => c.endpoint)).toEqual(["auth/login", "auth/login"]);
  });

  it("blank identity: no ERP call at all", async () => {
    expect(await loginFor(doc({ firstname: " " }))).toEqual({ ok: false, error: "profile_incomplete" });
    expect(calls).toEqual([]);
  });

  it("Clerk defaults never replace ERP values until the applicant saves their profile", async () => {
    answer("auth/login", { access_token: "tok" });
    answer("get", ok({ applicantdata: [{ lastname: "ERP-Овог", firstname: "ERP-Нэр", addr2: "" }] }));
    await pushApplication(doc({ addr2: "шинэ хаяг" }), app, deps());
    const profile = calls.find((c) => c.endpoint === "SaveHrApplicant")!.body as Record<string, unknown>;
    expect(profile).toMatchObject({ lastname: "ERP-Овог", firstname: "ERP-Нэр", addr2: "шинэ хаяг" });
  });

  it("treats an already-applied answer as sent", async () => {
    answer("auth/login", { access_token: "tok" });
    answer("SaveHrRecruitmentOrderApp", fail("Та энэ ажлын байранд аль хэдийн анкет илгээсэн байна."));
    answer("getRecruitmenRequestList", ok([{ entryid: 9, recruitmentorderid: 55 }]));
    const result = await pushApplication(doc(), app, deps());
    expect(result).toMatchObject({ status: "sent", erpEntryId: 9 });
  });

  it("sends the CV only when its hash changed", async () => {
    answer("auth/login", { access_token: "tok" });
    const withCv = { ...doc(), cv: { filename: "cv.pdf", filedata: "" } };
    const first = await pushApplication(withCv, app, deps({ filename: "cv.pdf", data: "QUJD" }));
    expect(calls.some((c) => c.endpoint === "SaveAppCV")).toBe(true);
    expect(first.cvHash).toMatch(/^[0-9a-f]{64}$/);

    calls = [];
    withCv.erp = { cvHash: first.cvHash };
    await pushApplication(withCv, app, deps({ filename: "cv.pdf", data: "QUJD" }));
    expect(calls.some((c) => c.endpoint === "SaveAppCV")).toBe(false);
  });

  it("a refusal from the ERP is reported, not thrown — and not retried", async () => {
    answer("auth/login", { access_token: "tok" });
    // rettype ≠ 0 on a 200: the ERP read the payload and said no.
    answer("SaveHrRecruitmentOrderApp", fail("ORA-01438"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await pushApplication(doc(), app, deps());
    expect(result).toMatchObject({ status: "failed", error: "erp_apply_rejected", retryable: false });
    // The upstream text never leaves the transport layer.
    expect(JSON.stringify(result)).not.toContain("ORA-01438");
  });

  it("a 500 is the ERP's problem, so it stays retryable", async () => {
    answer("auth/login", { access_token: "tok" });
    answer("SaveHrRecruitmentOrderApp", null);
    statuses.SaveHrRecruitmentOrderApp = 503;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await pushApplication(doc(), app, deps());
    expect(result).toMatchObject({ status: "failed", error: "erp_unavailable", retryable: true });
  });
});

describe("helpers", () => {
  it("overlays only non-empty values and never unsets a licence flag", () => {
    expect(profileOverlay({ addr2: "", firstname: "A", isa: false, isb: true, countryname: "x" })).toEqual({
      firstname: "A",
      isb: true,
    });
  });

  it("sends the fields the applicant emptied as empty — never a blank регистр, name or утас", () => {
    const profile = { addr2: "", relativeid2: null, contactname2: "", lastname: "", regno: "", mobilephone: "", custom1: "" };
    const cleared = ["addr2", "relativeid2", "contactname2", "lastname", "regno", "mobilephone"];
    expect(profileOverlay(profile, undefined, cleared)).toEqual({ addr2: "", relativeid2: null, contactname2: "" });
    // Blank but not cleared here (never known): left to the ERP.
    expect(profileOverlay(profile, undefined, [])).toEqual({});
  });

  it("before a save here the ERP's values win — except the утас, which is the ERP password", () => {
    const record = { addr2: "ERP", mobilephone: "99887766", email2: "" };
    expect(profileOverlay({ addr2: "D1", mobilephone: "99112233", email2: "c@x.mn" }, record)).toEqual({
      mobilephone: "99112233",
      email2: "c@x.mn",
    });
  });

  it("matches the ERP row by order id only — never guesses by name", () => {
    expect(findErpEntryId([{ entryid: 3, recruitmentorderid: 55 }], app)).toBe(3);
    expect(
      findErpEntryId([{ entryid: 8, posname: "Нягтлан", locname: "Төв" }], app),
    ).toBeUndefined();
  });

  it("pending waits a flat minute; failed waits its backoff; sent and capped rows never", () => {
    const now = Date.parse("2026-09-21T12:00:00Z");
    const at = (msAgo: number) => new Date(now - msAgo).toISOString();
    const row = (status: string, attempts: number, msAgo: number) => ({
      entryid: 1001,
      erp: { status, attempts, lastAttemptAt: at(msAgo), key: "k1" },
    });
    expect(isDue(row("pending", 1, 61_000), now)).toBe(true);
    expect(isDue(row("pending", 1, 30_000), now)).toBe(false);
    // Attempt 2's wait is ~2 min ±25%: under a minute is never due, and an
    // hour always is, whichever way the jitter fell.
    expect(isDue(row("failed", 2, 30_000), now)).toBe(false);
    expect(isDue(row("failed", 2, 60 * 60_000), now)).toBe(true);
    // Out of attempts: terminal, so never due again however long it waits.
    expect(isDue(row("failed", MAX_ATTEMPTS, 24 * 60 * 60_000), now)).toBe(false);
    expect(isDue(row("sent", 1, 60 * 60_000), now)).toBe(false);
    expect(isDue({}, now)).toBe(false);
  });

  it("a refused row is terminal however few attempts it has spent", () => {
    const now = Date.parse("2026-09-21T12:00:00Z");
    const old = new Date(now - 24 * 60 * 60_000).toISOString();
    const erp = { status: "failed", attempts: 1, lastAttemptAt: old, key: "k2" };
    expect(isDue({ entryid: 1, erp }, now)).toBe(true);
    expect(isDue({ entryid: 1, erp: { ...erp, terminal: true } }, now)).toBe(false);
    expect(isDue({ entryid: 1, erp: { ...erp, error: "erp_apply_rejected" } }, now)).toBe(false);
    // A transient code keeps its retries.
    expect(isDue({ entryid: 1, erp: { ...erp, error: "erp_unavailable" } }, now)).toBe(true);
  });

  it("the claim lease keeps a second run off a row another one is pushing", () => {
    const now = Date.parse("2026-09-21T12:00:00Z");
    const old = new Date(now - 24 * 60 * 60_000).toISOString();
    const base = { status: "failed", attempts: 1, lastAttemptAt: old, key: "k3" };
    const fresh = new Date(now - 10_000).toISOString();
    const stale = new Date(now - (CLAIM_TTL_MS + 1_000)).toISOString();
    expect(isDue({ entryid: 1, erp: { ...base, claimedAt: fresh } }, now)).toBe(false);
    // A claim older than the lease is reclaimed: the instance holding it died.
    expect(isDue({ entryid: 1, erp: { ...base, claimedAt: stale } }, now)).toBe(true);
  });
});
