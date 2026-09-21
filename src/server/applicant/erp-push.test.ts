import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ApplicantDoc } from "./handlers";
import { findErpEntryId, isDue, profileOverlay, pushApplication } from "./erp-push";

type Call = { endpoint: string; body: unknown; auth: string | null };

const ok = (retdata: unknown) => ({ rettype: 0, retmsg: "", retdata });
const fail = (retmsg: string) => ({ rettype: 1, retmsg, retdata: null });

function doc(profile: Record<string, unknown> = {}): ApplicantDoc {
  return {
    profile: { regno: "АА00000000", mobilephone: "99112233", firstname: "Бат", ...profile },
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

const deps = () => ({
  identity: { firstname: "Бат", lastname: "Дорж", email: "a@b.mn" },
});

let calls: Call[];
let answers: Record<string, unknown[]>;

function answer(endpoint: string, ...bodies: unknown[]) {
  answers[endpoint] = bodies;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://erp.test");
  calls = [];
  answers = {};
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.replace("/api/applicant/", "");
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw instanceof FormData ? "form" : null;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ endpoint, body, auth: headers.Authorization ?? null });
    const queue = answers[endpoint] ?? [ok(null)];
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify(next), { status: 200 });
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

  it("fails fast without regno/phone", async () => {
    const result = await pushApplication(doc({ regno: "" }), app, deps());
    expect(result).toEqual({ status: "failed", error: "profile_incomplete" });
    expect(calls).toEqual([]);
  });

  it("logs in, overlays the profile on the ERP record, applies and finds the entry id", async () => {
    answer("auth/login", { access_token: "tok" });
    answer("get", ok({ applicantdata: [{ lastname: "Дорж", firstname: "Old", addr2: "keep", isb: true }] }));
    answer("getRecruitmenRequestList", ok([{ entryid: 777, recruitmentorderid: 55 }]));

    const edited = doc({ addr2: "" });
    edited.erp = { profileEdited: true }; // the applicant saved their profile here
    const result = await pushApplication(edited, app, deps());

    expect(result).toMatchObject({ status: "sent", erpEntryId: 777 });
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

  it("a failed login never auto-registers (SaveHrAppUser would overwrite by регистр)", async () => {
    answer("auth/login", fail("зөрж байна"));
    const result = await pushApplication(doc(), app, deps());
    expect(result).toEqual({ status: "failed", error: "erp_login_failed" });
    expect(calls.map((c) => c.endpoint)).toEqual(["auth/login"]);
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

  it("reports a failed application without throwing", async () => {
    answer("auth/login", { access_token: "tok" });
    answer("SaveHrRecruitmentOrderApp", fail("ORA-01438"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await pushApplication(doc(), app, deps());
    expect(result).toMatchObject({ status: "failed", error: "erp_apply_failed" });
  });
});

describe("helpers", () => {
  it("overlays only non-empty values and never unsets a licence flag", () => {
    expect(profileOverlay({ addr2: "", firstname: "A", isa: false, isb: true, countryname: "x" })).toEqual({
      firstname: "A",
      isb: true,
    });
  });

  it("matches the ERP row by order id only — never guesses by name", () => {
    expect(findErpEntryId([{ entryid: 3, recruitmentorderid: 55 }], app)).toBe(3);
    expect(
      findErpEntryId([{ entryid: 8, posname: "Нягтлан", locname: "Төв" }], app),
    ).toBeUndefined();
  });

  it("retries pending after 1 min, failed after 10, up to 5 attempts", () => {
    const now = Date.parse("2026-09-21T12:00:00Z");
    const at = (msAgo: number) => new Date(now - msAgo).toISOString();
    const row = (status: string, attempts: number, msAgo: number) => ({
      erp: { status, attempts, lastAttemptAt: at(msAgo) },
    });
    expect(isDue(row("pending", 1, 61_000), now)).toBe(true);
    expect(isDue(row("pending", 1, 30_000), now)).toBe(false);
    expect(isDue(row("failed", 2, 5 * 60_000), now)).toBe(false);
    expect(isDue(row("failed", 2, 11 * 60_000), now)).toBe(true);
    expect(isDue(row("failed", 5, 60 * 60_000), now)).toBe(false);
    expect(isDue(row("sent", 1, 60 * 60_000), now)).toBe(false);
    expect(isDue({}, now)).toBe(false);
  });
});
