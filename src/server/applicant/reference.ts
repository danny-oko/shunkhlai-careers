import "server-only";

import { API_BASE_URL, APPLICANT_BASE, LANGUAGE, hasLiveBackend } from "@/lib/api/core/config";
import { jobItem, labelFor } from "@/server/mock/store";
import type { HandlerDeps, JobOrderRow, Row } from "./handlers";

/**
 * Reference lookups for `/api/me`: the same source the browser reads its
 * dropdowns and postings from. With `NEXT_PUBLIC_API_URL` set that is the live
 * ERP (these endpoints are public — no token); otherwise the bundled mock data.
 */

/** Dropdowns that take `search` only (see `lib/api/reference.ts`). */
const SEARCH_ONLY = new Set(["getPosGroupDropdown", "getPositionsDropdown", "GetSourceDropDown"]);

type Envelope = { rettype?: number; retdata?: unknown };

const LOOKUP_TIMEOUT_MS = 10_000;

async function liveGet(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}${APPLICANT_BASE}/${endpoint}?${query}`, {
    headers: { Accept: "application/json", language: LANGUAGE },
    cache: "no-store",
    // A pull labels its rows through here; a hung list must not hold it.
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
  const body = (await res.json()) as Envelope;
  if (body.rettype !== 0) throw new Error(`${endpoint}: rettype ${body.rettype}`);
  return body.retdata;
}

const blank = (value: unknown) => value === null || value === undefined || value === "";

function liveDeps(): Pick<HandlerDeps, "label" | "jobOrder"> {
  // One request may resolve several keys from the same list.
  const lists = new Map<string, Promise<Row[]>>();

  const list = (dropdown: string, parent: Row | undefined) => {
    const params: Record<string, string> = { search: "" };
    if (!SEARCH_ONLY.has(dropdown)) params.lfr = "false";
    for (const [key, value] of Object.entries(parent ?? {})) {
      if (!blank(value)) params[key] = String(value);
    }
    const cacheKey = `${dropdown}?${new URLSearchParams(params).toString()}`;
    let rows = lists.get(cacheKey);
    if (!rows) {
      rows = liveGet(dropdown, params).then((data) => (Array.isArray(data) ? (data as Row[]) : []));
      lists.set(cacheKey, rows);
    }
    return rows;
  };

  return {
    async label(dropdown, key, parent) {
      if (blank(key)) return "";
      try {
        const rows = await list(dropdown, parent);
        const row = rows.find((item) => String(item.key) === String(key));
        return row ? String(row.text) : "";
      } catch {
        // A missing label is cosmetic; never fail the save over it.
        return "";
      }
    },

    async jobOrder(entryID) {
      if (!entryID) return null;
      const data = (await liveGet("getRecruitmentOrderItem", { entryID: String(entryID) })) as {
        hrrecruitmentorder?: JobOrderRow[];
      } | null;
      return data?.hrrecruitmentorder?.[0] ?? null;
    },
  };
}

const mockDeps: Pick<HandlerDeps, "label" | "jobOrder"> = {
  label: (dropdown, key) => labelFor(dropdown, key),
  jobOrder: (entryID) => jobItem(entryID)?.hrrecruitmentorder[0] ?? null,
};

/** Label and posting lookups for one `/api/me` request. */
export function referenceDeps(): Pick<HandlerDeps, "label" | "jobOrder"> {
  return hasLiveBackend() ? liveDeps() : mockDeps;
}
