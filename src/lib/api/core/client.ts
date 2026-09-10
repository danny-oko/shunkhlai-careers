import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import {
  API_TIMEOUT_MS,
  AUTH_BASE,
  LANGUAGE,
  ORIGIN_URL,
  resolveBaseUrl,
} from "./config";
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
  baseURL: resolveBaseUrl(),
  timeout: API_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    // The collection sends this on every call; it selects the response language.
    language: LANGUAGE,
  },
});

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Let the browser set the multipart boundary for FormData payloads.
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    // Browsers set (and forbid scripts from setting) `Origin` themselves, so
    // this only has to be supplied for server-side calls.
    if (typeof window === "undefined" && ORIGIN_URL) {
      config.headers.Origin = ORIGIN_URL;
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
   Login hands back `access_token` and `refresh_token` together. The refresh
   endpoints come from the endpoint reference rather than the Postman
   collection, which never exercises them: they want the old (expiring) access
   token in the header *and* the refresh token in the body. A 401 triggers one
   refresh, and every request that raced into the same 401 waits on that single
   call rather than starting its own. A refresh that fails clears the session. */

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
      `${resolveBaseUrl()}${REFRESH_PATHS[audience]}`,
      { refreshToken },
      {
        timeout: API_TIMEOUT_MS,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          language: LANGUAGE,
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
