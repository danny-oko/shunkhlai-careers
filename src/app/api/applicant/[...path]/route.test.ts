import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dev mock's sign-up / sign-in, against what the live ERP answers:
 * `auth/login {regNo, mobile}` (verified live 2026-09-22) and `SaveHrAppUser`
 * (Postman 01/02 — create on a new регистр, log in on a known one with the
 * right phone, "…зөрж байна!" otherwise).
 */

type MockGlobal = typeof globalThis & { __careersMockDb?: unknown };
type Env = { rettype: number; retmsg: string; retdata: unknown };

const MISMATCH = "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!";

const USER = {
  lastname: "Бат",
  firstname: "Болд",
  regno: "УБ99010101",
  email: "bold@example.com",
  mobilephone: "99110011",
};

let dir: string;
let route: typeof import("./route");

beforeEach(async () => {
  // A fresh store, mirrored to a temp dir rather than the repo's .mock-data.
  dir = mkdtempSync(join(tmpdir(), "careers-mock-route-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  delete (globalThis as MockGlobal).__careersMockDb;
  route = await import("./route");
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as MockGlobal).__careersMockDb;
  rmSync(dir, { recursive: true, force: true });
});

const ctx = (endpoint: string) => ({ params: Promise.resolve({ path: endpoint.split("/") }) });

async function post(endpoint: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await route.POST(
    new Request(`http://x/api/applicant/${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) }),
    ctx(endpoint) as never,
  );
  return { status: res.status, body: (await res.json()) as Env };
}

async function get(endpoint: string, token: string) {
  const res = await route.GET(
    new Request(`http://x/api/applicant/${endpoint}`, { headers: { authorization: `Bearer ${token}` } }),
    ctx(endpoint) as never,
  );
  return { status: res.status, body: (await res.json()) as Env };
}

const tokenOf = (env: Env) => (env.retdata as { access_token?: string } | null)?.access_token;

describe("auth/login", () => {
  it("answers the token under retdata.access_token for the right регистр + утас", async () => {
    await post("SaveHrAppUser", USER);
    const r = await post("auth/login", { regNo: USER.regno, mobile: USER.mobilephone });
    expect(r.status).toBe(200);
    expect(r.body.rettype).toBe(0);
    const token = tokenOf(r.body);
    expect(token).toEqual(expect.any(String));
    expect((await get("get", token!)).body.rettype).toBe(0);
  });

  it("a wrong phone and an unknown регистр are the same HTTP 401, rettype -1, with the ERP's message", async () => {
    await post("SaveHrAppUser", USER);
    for (const body of [
      { regNo: USER.regno, mobile: "88000000" },
      { regNo: "АА00000000", mobile: USER.mobilephone },
      {},
    ]) {
      const r = await post("auth/login", body);
      expect(r.status).toBe(401);
      expect(r.body).toMatchObject({ rettype: -1, retmsg: MISMATCH, retdata: null });
    }
  });

  it("never creates an account", async () => {
    await post("auth/login", { regNo: USER.regno, mobile: USER.mobilephone });
    const r = await post("auth/login", { regNo: USER.regno, mobile: USER.mobilephone });
    expect(r.status).toBe(401);
  });
});

describe("SaveHrAppUser", () => {
  it("creates the applicant on a new регистр and answers a token", async () => {
    const r = await post("SaveHrAppUser", USER);
    expect(r.body.rettype).toBe(0);
    const token = tokenOf(r.body);
    const profile = (await get("get", token!)).body.retdata as Record<string, unknown>;
    expect(profile).toMatchObject({ lastname: "Бат", firstname: "Болд", regno: USER.regno, mobilephone: USER.mobilephone });
  });

  it("only logs in on a known регистр with the matching phone (nothing changed)", async () => {
    await post("SaveHrAppUser", USER);
    const r = await post("SaveHrAppUser", { ...USER, lastname: "Өөр", firstname: "Нэр" });
    expect(r.body.rettype).toBe(0);
    const profile = (await get("get", tokenOf(r.body)!)).body.retdata as Record<string, unknown>;
    expect(profile).toMatchObject({ lastname: "Бат", firstname: "Болд" });
  });

  it("a known регистр with another phone gets the mismatch message and no token", async () => {
    await post("SaveHrAppUser", USER);
    const r = await post("SaveHrAppUser", { ...USER, mobilephone: "88000000" });
    expect(r.body).toMatchObject({ rettype: 1, retmsg: MISMATCH, retdata: null });
  });
});
