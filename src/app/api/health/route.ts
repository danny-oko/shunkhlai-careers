import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { buildReport, DATABASE_TIMEOUT_MS, probeDatabase, readRelease } from "@/lib/health";

/**
 * `GET /api/health` — is this server actually working?
 *
 * The one command `docs/deploy.md` tells the operator to run after a release,
 * and the URL to point a monitor at. It answers 200 with `{"status":"ok"}` or
 * 503 with `{"status":"error"}`, so `curl -fsS` is a sufficient check and no
 * one has to read the body to know.
 *
 * "Working" means the database answers, not merely that Node is listening:
 * the failure this app actually has on the customer's network is Postgres
 * being unreachable while `next start` sits there happily serving HTML, and a
 * check that only proved the process was up would report that as healthy.
 * So this runs a real `select 1` through the same pool every request uses —
 * which also means a healthy answer proves the pool can still hand out a
 * connection, not just that the host pings.
 *
 * No authentication, deliberately: a monitor and a just-deployed operator both
 * need it, and `src/proxy.ts` only gates `/admin`. That is safe precisely
 * because the body is assembled in `src/lib/health.ts` from a fixed vocabulary
 * — no connection string, no credentials, no driver message, no stack trace,
 * on any path. Adding a field here means adding it there, under that rule.
 */

// Never cached, never prerendered: a health check served from the build's
// output would report the state of the laptop that ran `next build`.
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await probeDatabase(
    // Inside the callback, so a `DATABASE_URL` that is missing or unparseable
    // throws where `probeDatabase` can catch it and report `query_failed`
    // rather than crashing the route into a stack trace.
    () => getDb().execute(sql`select 1`),
    DATABASE_TIMEOUT_MS,
  );

  const report = buildReport(database, readRelease());

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    // A cached 200 outliving the outage it was taken during is the one way
    // this endpoint could actively mislead.
    headers: { "cache-control": "no-store" },
  });
}
