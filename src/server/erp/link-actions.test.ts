import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => {
  class FakeErpError extends Error {}
  return { auth: vi.fn(), linkAccount: vi.fn(), FakeErpError };
});
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("@/server/erp/link", () => ({ linkAccount: m.linkAccount }));
vi.mock("./link", () => ({ linkAccount: m.linkAccount }));
vi.mock("@/server/erp/client", () => ({ ErpError: m.FakeErpError }));
vi.mock("./client", () => ({ ErpError: m.FakeErpError }));

import { linkAccountAction, type LinkState } from "./link-actions";

const initial: LinkState = { ok: false };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.linkAccount.mockResolvedValue({ appId: "a1" });
});

describe("linkAccountAction", () => {
  it("unauthenticated → ok:false and never touches the ERP", async () => {
    m.auth.mockResolvedValue({ userId: null });
    const res = await linkAccountAction(initial, form({ regno: "AA00000000", phone: "99119911" }));
    expect(res.ok).toBe(false);
    expect(res.error).toEqual(expect.any(String));
    expect(m.linkAccount).not.toHaveBeenCalled();
  });

  it("missing regno → zod message, no linkAccount", async () => {
    const res = await linkAccountAction(initial, form({ phone: "99119911" }));
    expect(res).toEqual({ ok: false, error: "Регистрийн дугаараа оруулна уу." });
    expect(m.linkAccount).not.toHaveBeenCalled();
  });

  it("whitespace-only regno counts as missing", async () => {
    const res = await linkAccountAction(initial, form({ regno: "   ", phone: "99119911" }));
    expect(res).toEqual({ ok: false, error: "Регистрийн дугаараа оруулна уу." });
    expect(m.linkAccount).not.toHaveBeenCalled();
  });

  it("missing phone → zod message, no linkAccount", async () => {
    const res = await linkAccountAction(initial, form({ regno: "AA00000000" }));
    expect(res).toEqual({ ok: false, error: "Утасны дугаар / нууц үгээ оруулна уу." });
    expect(m.linkAccount).not.toHaveBeenCalled();
  });

  it("success → linkAccount gets trimmed values; empty optionals become undefined", async () => {
    const res = await linkAccountAction(
      initial,
      form({ regno: "  AA00000000 ", phone: " 99119911  ", firstname: "", lastname: "  ", email: "" }),
    );
    expect(res).toEqual({ ok: true });
    expect(m.linkAccount).toHaveBeenCalledTimes(1);
    expect(m.linkAccount).toHaveBeenCalledWith({
      clerkUserId: "u1",
      regno: "AA00000000",
      phone: "99119911",
      firstname: undefined,
      lastname: undefined,
      email: undefined,
    });
  });

  it("success with absent optional fields and trimmed names passes them through", async () => {
    await linkAccountAction(
      initial,
      form({ regno: "AA00000000", phone: "99119911", firstname: " Bat ", email: " b@x.mn " }),
    );
    expect(m.linkAccount).toHaveBeenCalledWith({
      clerkUserId: "u1",
      regno: "AA00000000",
      phone: "99119911",
      firstname: "Bat",
      lastname: undefined,
      email: "b@x.mn",
    });
  });

  it("ErpError → its message is returned", async () => {
    m.linkAccount.mockRejectedValue(new m.FakeErpError("Регистр эсвэл нууц үг буруу"));
    const res = await linkAccountAction(initial, form({ regno: "AA00000000", phone: "99119911" }));
    expect(res).toEqual({ ok: false, error: "Регистр эсвэл нууц үг буруу" });
  });

  it("non-ERP failure still yields ok:false (never throws to the form)", async () => {
    m.linkAccount.mockRejectedValue(new Error("d1 down"));
    const res = await linkAccountAction(initial, form({ regno: "AA00000000", phone: "99119911" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Алдаа гарлаа."); // internal message never reaches the browser
  });
});
