/**
 * What `/api/health` is allowed to say.
 *
 * This endpoint is the one thing a non-specialist operator is told to curl
 * after a deploy, and it is reachable without authentication — so it is also
 * the one endpoint an outsider on the customer's network can poke at will.
 * Everything here is therefore built around a single rule: the response is
 * assembled from a fixed vocabulary, never from an error object. A `pg`
 * connection failure carries the host, the port, the user and sometimes the
 * whole connection string in its `message`; forwarding that verbatim would
 * hand over the database's address and the account name for free.
 *
 * The functions live here rather than in the route so they can be unit-tested
 * without booting Next, and so the "never leak" rule has one place to hold.
 */

/** The only failure words this module will ever emit. */
export type DatabaseFailure = "timeout" | "unreachable" | "query_failed";

export type DatabaseCheck = {
  status: "ok" | "error";
  /** Round-trip time of `select 1`, milliseconds. Absent when it never landed. */
  latencyMs?: number;
  /** A category, never the driver's message. Absent when `status` is `ok`. */
  error?: DatabaseFailure;
};

export type Release = {
  /** From `APP_VERSION`, else npm's own, else null — never invented. */
  version: string | null;
  /** Short commit from `APP_COMMIT`/`GIT_COMMIT`, or null when nobody set it. */
  commit: string | null;
};

export type HealthReport = {
  status: "ok" | "error";
  checks: { database: DatabaseCheck };
  release: Release;
};

/** How long `select 1` gets before the check is called a failure. */
export const DATABASE_TIMEOUT_MS = 2000;

/**
 * A driver error turned into one of three words.
 *
 * Matching is on `code` and on the shape of the error, never on prose we then
 * pass through: the classifier can only return a member of `DatabaseFailure`,
 * so no amount of unexpected input can widen what the response contains.
 *
 * The codes are libpq's: `ECONNREFUSED`/`ENOTFOUND`/`EHOSTUNREACH` mean the
 * server is not answering at all (Postgres down, wrong host, firewall), which
 * is a different call-out than a database that answered and refused the query
 * (`28P01` bad password, `3D000` missing database) — the operator needs to
 * know which, and neither needs the detail to say so.
 */
export function classifyDatabaseError(error: unknown): DatabaseFailure {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") {
    if (code === "ETIMEDOUT" || code === "57014") return "timeout";
    if (code.startsWith("ECONN") || code === "ENOTFOUND" || code === "EHOSTUNREACH") {
      return "unreachable";
    }
  }
  return "query_failed";
}

/** Marker for the race below, so a timeout is not mistaken for a driver error. */
const TIMED_OUT = Symbol("database probe timed out");

/**
 * Run `select 1` and report how it went, within `timeoutMs`.
 *
 * `probe` is passed in rather than imported so tests can supply a real PGlite,
 * a thrower or something that never settles, and so this module stays free of
 * `server-only`.
 *
 * The timeout is a race, which abandons the query rather than cancelling it:
 * cancelling needs a second connection and `pg_cancel_backend`, which is a lot
 * of machinery for a health check. The abandoned `select 1` finishes on its own
 * and the pooled client returns to the pool, so nothing leaks — the only cost
 * is that a server under real load is reported unhealthy slightly before it
 * has actually given up, which is the direction a health check should err in.
 */
export async function probeDatabase(
  probe: () => Promise<unknown>,
  timeoutMs: number = DATABASE_TIMEOUT_MS,
): Promise<DatabaseCheck> {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      probe(),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      }),
    ]);
    if (result === TIMED_OUT) return { status: "error", error: "timeout" };
    return { status: "ok", latencyMs: Date.now() - startedAt };
  } catch (error) {
    /**
     * Logged in full, returned as one word. The operator reading
     * `journalctl -u shunhlai` is already on the box and may see the host and
     * the user name; the anonymous caller of `/api/health` may not.
     */
    console.error("[health] database check failed", error);
    return { status: "error", error: classifyDatabaseError(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Just the variables `readRelease` reads, rather than `NodeJS.ProcessEnv`.
 *
 * Two reasons. Next augments `ProcessEnv` to make `NODE_ENV` required, so a
 * caller — a test, most obviously — cannot pass a small literal without
 * inventing a `NODE_ENV` that has nothing to do with the question. And naming
 * the four keys documents the whole contract in one place: these are the only
 * environment variables this function will ever look at.
 */
type ReleaseEnv = {
  APP_VERSION?: string;
  APP_COMMIT?: string;
  GIT_COMMIT?: string;
  npm_package_version?: string;
  /**
   * The rest of the environment, which this function ignores. Present so that
   * `process.env` is assignable: without it every property is optional, which
   * makes this a "weak type", and TypeScript rejects anything sharing none of
   * the four names above — including `process.env` itself.
   */
  [key: string]: string | undefined;
};

/**
 * The running release, as far as the process can honestly tell.
 *
 * `.next` is built on a laptop or in CI and copied to the server without a
 * `.git` directory, so the commit cannot be discovered at runtime — it has to
 * be handed in. `deploy/shunhlai.service`'s `EnvironmentFile` is where
 * `APP_COMMIT` is set, and `docs/deploy.md` makes writing it part of the
 * release step. When nobody set it the field is `null`: a health endpoint that
 * guessed its own version would be worse than one that admits it does not know.
 */
export function readRelease(env: ReleaseEnv = process.env): Release {
  const commit = env.APP_COMMIT || env.GIT_COMMIT || null;
  return {
    version: env.APP_VERSION || env.npm_package_version || null,
    // Short form: the full 40 characters are noise in a terminal, and the
    // first 12 are unambiguous in a repository this size.
    commit: commit ? commit.slice(0, 12) : null,
  };
}

/** Overall status: the database is the only thing that can make this 503. */
export function buildReport(database: DatabaseCheck, release: Release): HealthReport {
  return {
    status: database.status === "ok" ? "ok" : "error",
    checks: { database },
    release,
  };
}
