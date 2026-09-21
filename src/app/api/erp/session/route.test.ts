import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => {
  class FakeUnreadable extends Error {
    constructor(msg = "credentials unreadable") {
      super(msg);
      this.name = "ErpCredentialsUnreadableError";
    }
  }
  return { auth: vi.fn(), getLink: vi.fn(), getToken: vi.fn(), FakeUnreadable };
});
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("@/server/erp/link", () => ({
  getLink: m.getLink,
  getValidErpToken: m.getToken,
  ErpCredentialsUnreadableError: m.FakeUnreadable,
}));

import { GET } from "./route";

const linked = { clerkUserId: "u1", status: "linked" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/erp/session", () => {
  it("401 when not signed in, touching nothing", async () => {
    m.auth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(m.getLink).not.toHaveBeenCalled();
    expect(m.getToken).not.toHaveBeenCalled();
  });

  it("409 {linked:false} when there is no link", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ linked: false });
    expect(m.getToken).not.toHaveBeenCalled();
  });

  it.each(["failed", "pending", "unlinked"])("409 {linked:false} when status is %s", async (status) => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue({ ...linked, status });
    const res = await GET();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ linked: false });
    expect(m.getToken).not.toHaveBeenCalled();
  });

  it("409 {linked:false, reason:'relink'} on ErpCredentialsUnreadableError", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue(linked);
    m.getToken.mockRejectedValue(new m.FakeUnreadable());
    const res = await GET();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ linked: false, reason: "relink" });
  });

  it("a raw OperationError (not the typed error) is still a 502, not a relink", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue(linked);
    m.getToken.mockRejectedValue(new DOMException("Cipher job failed", "OperationError"));
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "erp_unavailable" });
  });

  it("502 {error:'erp_unavailable'} on other errors, without leaking the message", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue(linked);
    m.getToken.mockRejectedValue(new Error("SECRET internal detail: ECONNREFUSED 10.0.0.5"));
    const res = await GET();
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "erp_unavailable" });
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("10.0.0.5");
  });

  it("502 on non-Error throwables too", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue(linked);
    m.getToken.mockRejectedValue("weird");
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "erp_unavailable" });
  });

  it("200 {linked:true, accessToken} on success", async () => {
    m.auth.mockResolvedValue({ userId: "u1" });
    m.getLink.mockResolvedValue(linked);
    m.getToken.mockResolvedValue("tok1");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linked: true, accessToken: "tok1" });
    expect(m.getToken).toHaveBeenCalledWith("u1");
  });
});
