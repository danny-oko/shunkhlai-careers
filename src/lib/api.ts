import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Base URL for the recruitment backend. Swap the env var in `.env.local`
 * when the real service is available; the relative `/api` fallback keeps
 * local development working against Next.js route handlers.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Let the browser set the multipart boundary for FormData payloads.
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("shunkhlai.token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export type ApiErrorShape = {
  message: string;
  status: number | null;
  fieldErrors?: Record<string, string[]>;
};

/** Normalises anything axios throws into a single predictable shape. */
export function toApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      errors?: Record<string, string[]>;
    }>;

    if (axiosError.code === "ECONNABORTED") {
      return { message: "The request timed out. Please try again.", status: null };
    }

    if (!axiosError.response) {
      return {
        message: "Could not reach the server. Check your connection and try again.",
        status: null,
      };
    }

    return {
      message:
        axiosError.response.data?.message ??
        "Something went wrong. Please try again.",
      status: axiosError.response.status,
      fieldErrors: axiosError.response.data?.errors,
    };
  }

  return { message: "An unexpected error occurred.", status: null };
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);
