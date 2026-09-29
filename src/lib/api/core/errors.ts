import axios, { type AxiosError } from "axios";

/**
 * Every response carries `rettype` (0 = success) and `retmsg`. A failure can
 * therefore arrive with HTTP 200 and a message in the body, which is why
 * `ApiError` exists alongside axios's own errors.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly rettype: number | null;

  constructor(message: string, options: { status?: number | null; rettype?: number | null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? null;
    this.rettype = options.rettype ?? null;
  }
}

export type ApiErrorShape = {
  message: string;
  status: number | null;
  fieldErrors?: Record<string, string[]>;
};

/** What a 413 means to the person who picked the file. */
export const UPLOAD_TOO_LARGE_MESSAGE = "Файл хэт том байна. Жижиг файл сонгоно уу.";

/** Normalises anything a call can throw into a single predictable shape. */
export function toApiError(error: unknown): ApiErrorShape {
  if (error instanceof ApiError) {
    return { message: error.message, status: error.status };
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      retmsg?: string;
      message?: string;
      errors?: Record<string, string[]>;
    }>;

    if (axiosError.code === "ECONNABORTED") {
      return { message: "Хүсэлт хугацаа хэтэрлээ. Дахин оролдоно уу.", status: null };
    }

    if (!axiosError.response) {
      return {
        message: "Серверт холбогдож чадсангүй. Холболтоо шалгаад дахин оролдоно уу.",
        status: null,
      };
    }

    return {
      message:
        axiosError.response.data?.retmsg ||
        axiosError.response.data?.message ||
        // A 413 without a `retmsg` is not the app's answer (`/api/me` sends
        // one): it is the host refusing the body before the app ran —
        // Vercel's 4.5 MB cap, or nginx's `client_max_body_size` — with a bare
        // page. "Try again" would send the same file into the same wall.
        (axiosError.response.status === 413
          ? UPLOAD_TOO_LARGE_MESSAGE
          : "Алдаа гарлаа. Дахин оролдоно уу."),
      status: axiosError.response.status,
      fieldErrors: axiosError.response.data?.errors,
    };
  }

  if (error instanceof Error && error.message) {
    return { message: error.message, status: null };
  }

  return { message: "Тодорхойгүй алдаа гарлаа.", status: null };
}

/** True when the backend could not be reached at all, rather than refusing. */
export function isBackendUnavailable(error: unknown): boolean {
  const { status } = toApiError(error);
  return status === null || status === 404;
}

/** True when the session is gone and the user needs to sign in again. */
export function isUnauthorized(error: unknown): boolean {
  return toApiError(error).status === 401;
}
