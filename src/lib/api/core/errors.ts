import axios, { type AxiosError } from "axios";

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

/**
 * True when the failure looks like "the backend isn't there" rather than a
 * rejection from the backend itself — no response, a timeout, or a 404 on a
 * path the service has not implemented yet.
 */
export function isBackendUnavailable(error: unknown): boolean {
  const { status } = toApiError(error);
  return status === null || status === 404;
}
