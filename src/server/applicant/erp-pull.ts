import "server-only";

import { ErpError, erpGet } from "./erp";
import { type ErpSnapshot, SOURCES } from "./erp-model";
import type { Row } from "./handlers";

/**
 * Pull (ERP → D1): reads the applicant's whole анкет from the live ERP with a
 * token from `auth/login`. The merge into the D1 document is pure and lives in
 * `erp-model.ts` (`applySnapshot`); saving is `erp-sync.ts`'s job.
 *
 * Reads only. Each part is fetched in parallel with its own 10 s timeout; a
 * part that fails comes back null and D1 keeps what it had for it.
 */

function logFailure(code: string, error: unknown) {
  const endpoint = error instanceof ErpError ? error.endpoint : "-";
  const status = error instanceof ErpError ? (error.status ?? error.message) : "-";
  console.error("[erp-pull]", code, endpoint, status);
}

async function part<T>(endpoint: string, token: string): Promise<T | null> {
  try {
    return await erpGet<T>(endpoint, token);
  } catch (error) {
    logFailure("erp_pull_part_failed", error);
    return null;
  }
}

/** `/get` → the record and the postings already applied to. */
function splitGet(data: unknown): { record: Row | null; recruitmentorders: Row[] | null } {
  if (!data || typeof data !== "object") return { record: null, recruitmentorders: null };
  const wrapped = data as { applicantdata?: unknown; recruitmentorders?: unknown };
  const record = Array.isArray(wrapped.applicantdata)
    ? ((wrapped.applicantdata[0] as Row | undefined) ?? null)
    : (data as Row);
  const orders = Array.isArray(wrapped.recruitmentorders)
    ? (wrapped.recruitmentorders as Row[])
    : null;
  return { record, recruitmentorders: orders };
}

export type PullScope = {
  /** `/get`: profile, CV, photo, recruitmentorders. */
  record?: boolean;
  /** Section sources (`GetHrAppEducationData`, …, `getInterestedJobsList`). */
  sources?: string[];
  /** `getRecruitmenRequestList`. */
  applications?: boolean;
};

export const FULL_PULL: PullScope = { record: true, sources: SOURCES, applications: true };

/** Reads what `scope` asks for. Never throws. */
export async function fetchSnapshot(token: string, scope: PullScope = FULL_PULL): Promise<ErpSnapshot> {
  const sources = scope.sources ?? [];
  const [get, applications, ...lists] = await Promise.all([
    scope.record ? part<unknown>("get", token) : Promise.resolve(null),
    scope.applications ? part<unknown>("getRecruitmenRequestList", token) : Promise.resolve(null),
    ...sources.map((source) => part<unknown>(source, token)),
  ]);

  const snapshot: ErpSnapshot = {
    ...splitGet(get),
    sources: {},
    applications: Array.isArray(applications) ? (applications as Row[]) : null,
  };
  sources.forEach((source, index) => {
    if (lists[index] !== null) snapshot.sources[source] = lists[index];
  });
  return snapshot;
}
