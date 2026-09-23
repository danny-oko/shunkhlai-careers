import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * `/api/health` against a REAL PostgreSQL engine — PGlite, Postgres compiled
 * to WASM, in this process — so "the database answered `select 1`" is a real
 * round trip through drizzle and not a stubbed boolean. Nothing here reaches a
 * network, and in particular nothing reaches the customer's server.
 *
 * The failure cases matter more than the happy one: this route is unauthenticated,
 * so what it says when the database is down is a security property, not a nicety.
 */

const state = vi.hoisted(() => ({
  pg: null as TestDatabase | null,
  /** Swapped per test to stand in for a database that is not answering. */
  failure: null as (() => never) | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");
  state.pg = await createTestDatabase();
  return {
    ...schema,
    schema,
    getDb: () => {
      // `getDb()` itself throws when DATABASE_URL is missing or unparseable —
      // reproduced here so the route is proven to survive that, not only a
      // query that rejects.
      if (state.failure) state.failure();
      return state.pg!.db;
    },
  };
});

import { GET } from "./route";

/** The response, parsed, with the status code alongside it. */
async function get(): Promise<{ status: number; body: Record<string, unknown>; cacheControl: string | null }> {
  const response = await GET();
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
    cacheControl: response.headers.get("cache-control"),
  };
}

const CONNECTION_STRING = "postgresql://app_user:hunter2@192.168.2.23:5432/app_db";

beforeAll(async () => {
  // Touch the mocked module so PGlite is built before the first case times it.
  await import("@/lib/db");
});

afterEach(() => {
  state.failure = null;
  delete process.env.APP_COMMIT;
  delete process.env.APP_VERSION;
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("answers 200 with an ok status when the database answers", async () => {
    const { status, body, cacheControl } = await get();

    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toMatchObject({ database: { status: "ok" } });
    expect((body.checks as { database: { latencyMs: number } }).database.latencyMs).toBeTypeOf("number");
    expect(cacheControl).toBe("no-store");
  });

  it("reports the version and commit it was given", async () => {
    process.env.APP_VERSION = "0.1.0";
    process.env.APP_COMMIT = "0123456789abcdef0123456789abcdef01234567";

    const { body } = await get();

    expect(body.release).toEqual({ version: "0.1.0", commit: "0123456789ab" });
  });

  it("answers 503 when the database is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.failure = () => {
      throw Object.assign(new Error(`connect ECONNREFUSED ${CONNECTION_STRING}`), {
        code: "ECONNREFUSED",
      });
    };

    const { status, body } = await get();

    expect(status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.checks).toEqual({ database: { status: "error", error: "unreachable" } });
  });

  it("never leaks the connection string, the password or a stack trace", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.failure = () => {
      const error = new Error(`password authentication failed for user "app_user" — ${CONNECTION_STRING}`);
      throw Object.assign(error, { code: "28P01" });
    };

    const { status, body } = await get();
    const serialised = JSON.stringify(body);

    expect(status).toBe(503);
    for (const forbidden of ["hunter2", "192.168.2.23", "app_user", "postgresql://", "at Object", ".ts:"]) {
      expect(serialised).not.toContain(forbidden);
    }
    // All the caller learns is that the query did not succeed.
    expect(body.checks).toEqual({ database: { status: "error", error: "query_failed" } });
  });

  it("does not require auth — it takes no request and reads no cookie", async () => {
    // `GET()` is called with no arguments throughout this file, which only
    // compiles because the route ignores the request entirely. Worth asserting
    // as behaviour: a later change that starts reading a session would break
    // the monitor and the post-deploy check at once.
    expect(GET.length).toBe(0);
  });
});
