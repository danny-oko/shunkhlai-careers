import { describe, expect, it } from "vitest";

import { isReadOnlySql, readD1Response } from "./read";

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
    const res = reply(
      JSON.stringify({ success: false, errors: [{ message: "no such table" }] }),
      400,
    );
    await expect(readD1Response(res)).rejects.toThrow(/HTTP 400 .*no such table/u);
  });
});

/**
 * D1 still holds the customer's production data and this port only ever reads
 * it, so the guard is worth pinning down: anything that could write, or that
 * hides a second statement behind a semicolon, is not a read.
 */
describe("isReadOnlySql", () => {
  it("accepts a single select, with or without a trailing semicolon", () => {
    expect(isReadOnlySql("SELECT * FROM news_article")).toBe(true);
    expect(isReadOnlySql("  select id from app_user;  ")).toBe(true);
    expect(isReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x")).toBe(true);
  });

  it("rejects writes and stacked statements", () => {
    expect(isReadOnlySql("DELETE FROM news_article")).toBe(false);
    expect(isReadOnlySql("UPDATE news_article SET status = 'draft'")).toBe(false);
    expect(isReadOnlySql("SELECT 1; DROP TABLE news_article")).toBe(false);
  });
});
