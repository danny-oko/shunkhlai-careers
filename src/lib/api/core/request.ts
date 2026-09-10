import type { AxiosRequestConfig } from "axios";

import { http } from "./client";

/**
 * Response envelopes are not described in the endpoint reference. Backends of
 * this shape usually answer either with the payload itself or with it wrapped
 * in `data` / `result`, so `unwrap` peels one such layer and leaves anything
 * else untouched. If the real service turns out to use a single fixed
 * envelope, delete the guesswork here — it is the only place that assumes one.
 */
export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "result", "Data", "Result"] as const) {
      if (key in record) return record[key] as T;
    }
  }
  return payload as T;
}

/** Same as `unwrap`, but guarantees an array for list endpoints. */
export function unwrapList<T>(payload: unknown): T[] {
  const value = unwrap<unknown>(payload);
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [value as T];
}

export type RequestOptions = Omit<AxiosRequestConfig, "url" | "method" | "params" | "data">;

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> {
  const response = await http.get(path, { ...options, params });
  return unwrap<T>(response.data);
}

export async function apiGetList<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T[]> {
  const response = await http.get(path, { ...options, params });
  return unwrapList<T>(response.data);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions & { params?: Record<string, unknown> },
): Promise<T> {
  const response = await http.post(path, body, options);
  return unwrap<T>(response.data);
}

/** POST a single file as `multipart/form-data`, the shape the upload endpoints expect. */
export async function apiUpload<T>(
  path: string,
  file: File,
  options?: RequestOptions & { params?: Record<string, unknown>; fieldName?: string },
): Promise<T> {
  const form = new FormData();
  form.append(options?.fieldName ?? "file", file, file.name);
  const response = await http.post(path, form, options);
  return unwrap<T>(response.data);
}
