/**
 * Transport configuration for the recruitment backend.
 *
 * `NEXT_PUBLIC_API_URL` must be an **absolute** origin (e.g.
 * `https://recruit.shunkhlai.mn`) because the same modules run on the server,
 * where a relative base URL has nothing to resolve against.
 *
 * When it is unset the app runs in *fixture mode*: the public job endpoints
 * answer from `src/lib/jobs/fixtures.ts` instead of the network, so the whole
 * pipeline — request → DTO → mapper → UI — stays exercisable offline.
 */
const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export const API_BASE_URL = configured ?? "";

export const API_TIMEOUT_MS = 15_000;

/** True once a real backend origin is configured. */
export function hasLiveBackend(): boolean {
  return API_BASE_URL.length > 0;
}

/* -------------------------------------------------------------------------
   Endpoint bases
   ------------------------------------------------------------------------
   Every path in the endpoint reference hangs off one of these three roots.
   Modules compose paths from them so a base change is a one-line edit. */

export const APPLICANT_BASE = "/api/applicant";
export const AUTH_BASE = "/api/applicant/auth";
export const SYSTEM_BASE = "/api/system";
