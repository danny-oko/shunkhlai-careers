import { describe, expect, it, vi } from "vitest";

import {
  buildReport,
  classifyDatabaseError,
  probeDatabase,
  readRelease,
  type DatabaseFailure,
} from "./health";

/** A `pg`-shaped error: the driver sets `code` and a chatty `message`. */
function pgError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe("classifyDatabaseError", () => {
  it("calls a refused or unresolvable connection unreachable", () => {
    expect(classifyDatabaseError(pgError("ECONNREFUSED", "connect ECONNREFUSED"))).toBe("unreachable");
    expect(classifyDatabaseError(pgError("ECONNRESET", "read ECONNRESET"))).toBe("unreachable");
    expect(classifyDatabaseError(pgError("ENOTFOUND", "getaddrinfo ENOTFOUND"))).toBe("unreachable");
    expect(classifyDatabaseError(pgError("EHOSTUNREACH", "connect EHOSTUNREACH"))).toBe("unreachable");
  });

  it("calls a socket timeout and a cancelled statement a timeout", () => {
    expect(classifyDatabaseError(pgError("ETIMEDOUT", "connect ETIMEDOUT"))).toBe("timeout");
    expect(classifyDatabaseError(pgError("57014", "canceling statement"))).toBe("timeout");
  });

  it("calls everything else query_failed, including what is not an Error", () => {
    // A bad password and a missing database are the two the operator hits
    // first; neither may be spelled out to an anonymous caller.
    expect(classifyDatabaseError(pgError("28P01", "password authentication failed"))).toBe("query_failed");
    expect(classifyDatabaseError(pgError("3D000", 'database "app_db" does not exist'))).toBe("query_failed");
    expect(classifyDatabaseError("just a string")).toBe("query_failed");
    expect(classifyDatabaseError(null)).toBe("query_failed");
  });
});

describe("probeDatabase", () => {
  it("reports ok with a latency when the query lands", async () => {
    const check = await probeDatabase(async () => ({ rows: [{ "?column?": 1 }] }), 1000);

    expect(check.status).toBe("ok");
    expect(check.latencyMs).toBeTypeOf("number");
    expect(check.error).toBeUndefined();
  });

  it("reports a timeout without waiting for the query, and keeps waiting cheaply", async () => {
    vi.useFakeTimers();
    try {
      const check = probeDatabase(() => new Promise(() => {}), 2000);
      await vi.advanceTimersByTimeAsync(2000);

      expect(await check).toEqual({ status: "error", error: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("swallows the driver's message and logs it instead", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const secret = "postgresql://app_user:hunter2@192.168.2.23:5432/app_db";
      const check = await probeDatabase(async () => {
        throw pgError("ECONNREFUSED", `connect ECONNREFUSED — ${secret}`);
      }, 1000);

      expect(check).toEqual({ status: "error", error: "unreachable" });
      expect(JSON.stringify(check)).not.toContain("hunter2");
      expect(JSON.stringify(check)).not.toContain("192.168.2.23");
      // The detail is not lost, just kept where only someone on the box sees it.
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});

describe("readRelease", () => {
  it("prefers APP_VERSION and shortens the commit", () => {
    expect(
      readRelease({ APP_VERSION: "0.2.0", APP_COMMIT: "0123456789abcdef0123456789abcdef01234567" }),
    ).toEqual({ version: "0.2.0", commit: "0123456789ab" });
  });

  it("falls back to npm's version and to GIT_COMMIT", () => {
    expect(readRelease({ npm_package_version: "0.1.0", GIT_COMMIT: "abc1234" })).toEqual({
      version: "0.1.0",
      commit: "abc1234",
    });
  });

  it("admits it does not know rather than guessing", () => {
    expect(readRelease({})).toEqual({ version: null, commit: null });
  });
});

describe("buildReport", () => {
  it("is ok only when the database is", () => {
    const release = { version: "0.1.0", commit: null };

    expect(buildReport({ status: "ok", latencyMs: 3 }, release).status).toBe("ok");

    for (const error of ["timeout", "unreachable", "query_failed"] as DatabaseFailure[]) {
      expect(buildReport({ status: "error", error }, release).status).toBe("error");
    }
  });
});
