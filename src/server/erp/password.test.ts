import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// In-memory stand-in for the D1 row, with a chainable drizzle-shaped surface.
const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
  login: vi.fn(),
  post: vi.fn(),
  get: vi.fn(),
  failNextUpdate: false,
  failAllUpdates: false,
  FakeErpError: class extends Error {},
}));
const { FakeErpError } = state;

vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));
vi.mock("@/lib/db", () => ({
  applicantLink: {},
  applicantProfile: {},
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => (state.row ? [state.row] : []) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (state.failAllUpdates || state.failNextUpdate) {
            state.failNextUpdate = false;
            throw new Error("d1 down");
          }
          state.updates.push(values);
          state.row = { ...state.row, ...values };
        },
      }),
    }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }),
  }),
}));
vi.mock("@/lib/db/crypto", () => ({
  encryptSecret: async (v: string) => `enc(${v})`,
  decryptSecret: async (v: string) => v.replace(/^enc\((.*)\)$/, "$1"),
}));

vi.mock("./client", () => ({
  ErpError: state.FakeErpError,
  erpLogin: state.login,
  erpPost: state.post,
  erpGet: state.get,
}));

import { saveProfile } from "./link";
import { changeErpPassword } from "./password";

const session = { accessToken: "tok2", refreshToken: null, expiresAt: Date.now() + 3_600_000, appId: "a1" };

beforeEach(() => {
  vi.clearAllMocks();
  state.updates = [];
  state.failNextUpdate = false;
  state.failAllUpdates = false;
  state.row = {
    regnoEnc: "enc(AA00000000)",
    phoneEnc: "enc(oldpw)",
    erpAccessTokenEnc: "enc(tok1)",
    erpRefreshTokenEnc: null,
    erpAppId: "a1",
    erpTokenExpiresAt: new Date(Date.now() + 3_600_000),
    status: "linked",
  };
});

describe("changeErpPassword", () => {
  it("stores the new password once and re-logs in with it on success", async () => {
    state.post.mockResolvedValue({});
    state.login.mockResolvedValue(session);
    const result = await changeErpPassword("u1", "oldpw", "newpw1");

    expect(state.post).toHaveBeenCalledWith("/api/applicant/changeUserInfo", "tok1", {
      type: "PASSWORD",
      oldpassword: "oldpw",
      newpassword: "newpw1",
    });
    expect(state.updates.filter((u) => "phoneEnc" in u)).toHaveLength(1);
    expect(state.row?.phoneEnc).toBe("enc(newpw1)");
    expect(state.login).toHaveBeenCalledWith("AA00000000", "newpw1");
    expect(state.row?.erpAccessTokenEnc).toBe("enc(tok2)");
    expect(state.row?.status).toBe("linked");
    expect(result).toEqual({ relinkRequired: false });
  });

  it("leaves the stored credential untouched when the ERP refuses", async () => {
    state.post.mockRejectedValue(new FakeErpError("Хуучин нууц үг буруу байна"));
    await expect(changeErpPassword("u1", "bad", "newpw1")).rejects.toThrow("Хуучин нууц үг буруу байна");
    expect(state.updates).toHaveLength(0);
    expect(state.row?.phoneEnc).toBe("enc(oldpw)");
    expect(state.login).not.toHaveBeenCalled();
  });

  it("keeps the new password and flags the row when re-login fails", async () => {
    state.post.mockResolvedValue({});
    state.login.mockRejectedValue(new FakeErpError("Нэвтрэх амжилтгүй"));
    const result = await changeErpPassword("u1", "oldpw", "newpw1");

    expect(state.row?.phoneEnc).toBe("enc(newpw1)");
    expect(state.row?.status).toBe("failed");
    expect(state.row?.lastError).toBe("Нэвтрэх амжилтгүй");
    expect(result).toEqual({ relinkRequired: true });
  });
});

describe("changeErpPassword when D1 fails after the ERP accepted the change", () => {
  it("reports relinkRequired instead of throwing when the secret write fails", async () => {
    state.post.mockResolvedValue({});
    state.failNextUpdate = true;
    const result = await changeErpPassword("u1", "oldpw", "newpw1");

    expect(result).toEqual({ relinkRequired: true });
    expect(state.login).not.toHaveBeenCalled();
  });

  it("never persists a raw driver error message in lastError", async () => {
    state.post.mockResolvedValue({});
    state.login.mockRejectedValue(new Error("Failed query: update ... params: enc(newpw1)"));
    await changeErpPassword("u1", "oldpw", "newpw1");

    expect(state.row?.status).toBe("failed");
    expect(String(state.row?.lastError)).not.toContain("enc(");
    expect(String(state.row?.lastError)).not.toContain("Failed query");
  });

  it("still reports relinkRequired when even the failed-flag write throws", async () => {
    state.post.mockResolvedValue({});
    state.failAllUpdates = true;
    await expect(changeErpPassword("u1", "oldpw", "newpw1")).resolves.toEqual({ relinkRequired: true });
  });
});

describe("saveProfile", () => {
  it("echoes licence and custom fields instead of wiping them", async () => {
    // Snapshot read (no mirror row): getProfileSnapshot selects applicantProfile,
    // which the stub answers from state.row, so seed a dataJson row for it.
    const record = {
      regno: "AA00000000",
      mobilephone: "99000000",
      lastname: "L",
      firstname: "F",
      isb: true,
      custom1: "note",
      custom2: null,
      relativeid: null,
      picturedata: "xxx",
      totalper: 50,
      addr2: "old",
    };
    // The D1 mirror is STALE (old phone, no licence): saveProfile must ignore it.
    const stale = { ...record, mobilephone: "11111111", isb: false, custom1: null };
    state.row = { ...state.row, dataJson: JSON.stringify(stale), syncedAt: new Date() };
    state.post.mockResolvedValue({});
    state.get.mockResolvedValue({ applicantdata: [record] });

    await saveProfile("u1", { addr2: "new" });

    const call = state.post.mock.calls.find((c) => c[0] === "/api/applicant/SaveHrApplicant");
    expect(call).toBeDefined();
    const payload = call![2] as Record<string, unknown>;
    expect(payload).toMatchObject({ isb: true, custom1: "note", mobilephone: "99000000", addr2: "new" });
    expect(payload).not.toHaveProperty("picturedata");
    expect(payload).not.toHaveProperty("totalper");
    expect(payload).not.toHaveProperty("relativeid");
    expect(payload).not.toHaveProperty("custom2");
  });

  it("refuses to save when the live ERP record cannot be read", async () => {
    state.row = { ...state.row, dataJson: JSON.stringify({ mobilephone: "11111111" }), syncedAt: new Date() };
    state.get.mockResolvedValue({ applicantdata: [] });

    await expect(saveProfile("u1", { addr2: "new" })).rejects.toThrow();
    expect(state.post.mock.calls.some((c) => c[0] === "/api/applicant/SaveHrApplicant")).toBe(false);
  });
});
