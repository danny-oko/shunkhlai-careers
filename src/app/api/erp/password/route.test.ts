import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => {
  class FakeErpError extends Error {}
  return { auth: vi.fn(), change: vi.fn(), FakeErpError };
});
const { FakeErpError } = m;
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("@/server/erp/client", () => ({ ErpError: m.FakeErpError }));
vi.mock("@/server/erp/password", () => ({ changeErpPassword: m.change }));

import { POST } from "./route";

const req = (body: unknown) =>
  new Request("http://x/api/erp/password", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/erp/password", () => {
  it("rejects an unauthenticated caller without touching the ERP", async () => {
    m.auth.mockResolvedValue({ userId: null });
    const res = await POST(req({ oldpassword: "a", newpassword: "b" }));
    expect(res.status).toBe(401);
    expect(m.change).not.toHaveBeenCalled();
  });

  it("returns the ERP retmsg on refusal", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.change.mockRejectedValue(new FakeErpError("Хуучин нууц үг буруу"));
    const res = await POST(req({ oldpassword: "a", newpassword: "bbbbbb" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Хуучин нууц үг буруу" });
  });

  it("reports success and the relink flag", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.change.mockResolvedValue({ relinkRequired: true });
    const res = await POST(req({ oldpassword: "a", newpassword: "bbbbbb" }));
    expect(await res.json()).toEqual({ ok: true, relinkRequired: true });
    expect(m.change).toHaveBeenCalledWith("u1", "a", "bbbbbb");
  });
});
