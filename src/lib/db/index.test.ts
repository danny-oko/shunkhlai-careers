import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { readD1Response } = await import("./index");

const reply = (body: string, status = 200) => new Response(body, { status });

describe("readD1Response", () => {
  it("returns the first statement's rows", async () => {
    const res = reply(JSON.stringify({ success: true, result: [{ results: [{ id: "a" }] }] }));
    await expect(readD1Response(res)).resolves.toEqual([{ id: "a" }]);
  });

  it("names the HTTP status when the gateway answers with HTML", async () => {
    await expect(readD1Response(reply("<html>Bad gateway</html>", 502))).rejects.toThrow(
      /HTTP 502 <html>Bad gateway/u,
    );
  });

  it("carries D1's own errors through", async () => {
    const res = reply(JSON.stringify({ success: false, errors: [{ message: "no such table" }] }), 400);
    await expect(readD1Response(res)).rejects.toThrow(/HTTP 400 .*no such table/u);
  });
});
