import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import { API_TIMEOUT_MS, LANGUAGE, ORIGIN_URL, isMePath, resolveBaseUrl } from "./config";
import { type Audience, clearSession, readAccessToken } from "./tokens";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Which token tier this call belongs to. Defaults to `applicant`. */
    audience?: Audience;
    /** Send the call without an Authorization header. */
    skipAuth?: boolean;
  }
}

/**
 * Browsers set (and forbid scripts from setting) `Origin` themselves, so this
 * is only supplied for server-side calls — as the collection's `originUrl`.
 */
const serverOrigin = typeof window === "undefined" && ORIGIN_URL ? { Origin: ORIGIN_URL } : {};

export const http: AxiosInstance = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: API_TIMEOUT_MS,
  withCredentials: false,
  // The collection spells multi-valued parameters as a repeated key —
  // `?ids=1&ids=2` — where axios would write `ids[]=1&ids[]=2` and the backend
  // would see a parameter it does not have. Nothing sent an array until the
  // dropdowns began resolving a saved value through `ids`, so this never
  // surfaced; `indexes: null` is what repeats the bare key.
  paramsSerializer: { indexes: null },
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    // The collection sends this on every call; it selects the response language.
    language: LANGUAGE,
    ...serverOrigin,
  },
});

/** Let the browser set the multipart boundary for FormData payloads. */
function isFormData(data: unknown): boolean {
  return typeof FormData !== "undefined" && data instanceof FormData;
}

function audienceOf(config: InternalAxiosRequestConfig): Audience {
  return config.audience ?? "applicant";
}

function bearerFor(config: InternalAxiosRequestConfig): string | null {
  if (config.skipAuth) return null;
  const token = readAccessToken(audienceOf(config));
  return token ? `Bearer ${token}` : null;
}

/**
 * `/api/me/*` is this app's own route, authenticated by the Clerk cookie: send
 * it same-origin with credentials and no bearer. `skipAuth` also keeps its 401
 * from clearing a stored token — the session provider reads that 401 itself.
 */
function routeToMe(config: InternalAxiosRequestConfig): void {
  if (!isMePath(config.url)) return;
  config.baseURL = "";
  config.withCredentials = true;
  config.skipAuth = true;
}

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (isFormData(config.data)) delete config.headers["Content-Type"];
    routeToMe(config);

    const bearer = bearerFor(config);
    if (bearer) config.headers.Authorization = bearer;

    return config;
  },
  (error) => Promise.reject(error),
);

/* -------------------------------------------------------------------------
   Expired session
   ------------------------------------------------------------------------
   The Postman collection never refreshes a token — it signs in again. So a
   401 ("Invalid token") ends the session: the stored tokens are cleared, the
   session provider hears about it through `onSessionChange`, and the account
   pages send the applicant back to the sign-in form. Public reads carry
   `skipAuth` and never get here. */

function isUnauthorizedResponse(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function failedConfig(error: unknown): InternalAxiosRequestConfig | undefined {
  return isUnauthorizedResponse(error) ? error.config : undefined;
}

/** The audience whose session a 401 has ended, if any. */
function endedSession(error: unknown): Audience | null {
  const config = failedConfig(error);
  return config && !config.skipAuth ? audienceOf(config) : null;
}

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    const audience = endedSession(error);
    if (audience) clearSession(audience);
    return Promise.reject(error);
  },
);
