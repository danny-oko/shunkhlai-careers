/**
 * Transport configuration for the recruitment backend.
 *
 * `NEXT_PUBLIC_API_URL` is the API origin (e.g. `https://careers.shunkhlai.mn`),
 * matching the Postman collection's `baseUrl`. Leave it unset and the app talks
 * to the bundled mock backend in `src/app/api/applicant/**`, which serves the
 * collection's own example payloads — the site runs end to end with no server.
 */
const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export const API_BASE_URL = configured ?? "";

/** True once a real backend origin is configured. */
export function hasLiveBackend(): boolean {
  return API_BASE_URL.length > 0;
}

/**
 * Where requests actually go.
 *
 * In the browser an empty base means "same origin", which is what reaches the
 * mock routes. On the server there is no origin to be relative to: locally the
 * dev server's own port works, and on a Vercel deployment the only address that
 * resolves is the deployment URL. Neither can serve a render that happens
 * before the server is up, which is why server-side job reads bypass HTTP
 * entirely (see `src/lib/jobs/local.ts`).
 */
export function resolveBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window !== "undefined") return "";

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

/** The collection sends both of these on every request. */
export const ORIGIN_URL = process.env.NEXT_PUBLIC_ORIGIN_URL?.trim() || API_BASE_URL;
export const LANGUAGE = process.env.NEXT_PUBLIC_API_LANGUAGE?.trim() || "MN";

export const API_TIMEOUT_MS = 15_000;

/* Every path in the collection hangs off this one base. */
export const APPLICANT_BASE = "/api/applicant";
/** Documented in the endpoint reference, absent from the Postman collection. */
export const AUTH_BASE = "/api/applicant/auth";
export const SYSTEM_BASE = "/api/system";
