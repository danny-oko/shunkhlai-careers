import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import { API_BASE_URL, API_TIMEOUT_MS, AUTH_BASE } from "./config";
import {
  type Audience,
  clearSession,
  readAccessToken,
  readRefreshToken,
  readTokenPair,
  storeSession,
} from "./tokens";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Which token tier this call belongs to. Defaults to `applicant`. */
    audience?: Audience;
    /** Send the call without an Authorization header. */
    skipAuth?: boolean;
    /** Internal: set once a request has been replayed after a token refresh. */
    retriedAfterRefresh?: boolean;
  }
}

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Let the browser set the multipart boundary for FormData payloads.
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    if (!config.skipAuth) {
      const token = readAccessToken(config.audience ?? "applicant");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* -------------------------------------------------------------------------
   Token refresh
   ------------------------------------------------------------------------
   Both refresh endpoints are documented as `Auth: Special` — they want the
   old (expiring) access token in the header *and* the refresh token in the
   body. A 401 therefore triggers one refresh, and every request that raced
   into the same 401 waits on that single call rather than starting its own. */

const REFRESH_PATHS: Record<Audience, string> = {
  applicant: `${AUTH_BASE}/refresh-token`,
  admin: `${AUTH_BASE}/admin-user-refresh-token`,
};

const inFlightRefresh = new Map<Audience, Promise<string | null>>();

async function refreshAccessToken(audience: Audience): Promise<string | null> {
  const staleAccessToken = readAccessToken(audience);
  const refreshToken = readRefreshToken(audience);
  if (!staleAccessToken || !refreshToken) return null;

  try {
    // A bare axios call, not `http`: the instance's own interceptors would
    // recurse straight back into this function on another 401.
    const response = await axios.post(
      `${API_BASE_URL}${REFRESH_PATHS[audience]}`,
      { refreshToken },
      {
        timeout: API_TIMEOUT_MS,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${staleAccessToken}`,
        },
      },
    );

    const pair = readTokenPair(response.data);
    if (!pair) return null;

    storeSession(pair, audience);
    return pair.accessToken;
  } catch {
    return null;
  }
}

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const config = error.config as InternalAxiosRequestConfig | undefined;
    if (!config || config.skipAuth || config.retriedAfterRefresh) {
      return Promise.reject(error);
    }

    const audience = config.audience ?? "applicant";

    let refresh = inFlightRefresh.get(audience);
    if (!refresh) {
      refresh = refreshAccessToken(audience).finally(() => {
        inFlightRefresh.delete(audience);
      });
      inFlightRefresh.set(audience, refresh);
    }

    const accessToken = await refresh;
    if (!accessToken) {
      clearSession(audience);
      return Promise.reject(error);
    }

    config.retriedAfterRefresh = true;
    config.headers.Authorization = `Bearer ${accessToken}`;
    return http.request(config);
  },
);
