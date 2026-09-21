import type { AxiosRequestConfig } from "axios";

import { http } from "./client";
import { ApiError } from "./errors";

/**
 * Every endpoint answers with the same envelope:
 *
 *   { totalrow, affectedrows, retdata, rettype, retmsg, traceno, … }
 *
 * `rettype` 0 means success and `retdata` is the payload; anything else is a
 * failure whose text is in `retmsg` — often delivered with HTTP 200, which is
 * why unwrapping and error handling live together here.
 */
export type ApiEnvelope<T> = {
  retdata: T;
  rettype: number;
  retmsg: string;
  totalrow?: number;
  affectedrows?: number;
  traceno?: number;
};

export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "rettype" in payload) {
    const envelope = payload as ApiEnvelope<T>;
    if (envelope.rettype !== 0) {
      throw new ApiError(envelope.retmsg || "Хүсэлт амжилтгүй боллоо.", {
        rettype: envelope.rettype,
      });
    }
    return envelope.retdata;
  }
  // A handful of endpoints (file uploads) answer with a bare string.
  return payload as T;
}

/** Same as `unwrap`, but guarantees an array for list endpoints. */
export function unwrapList<T>(payload: unknown): T[] {
  const value = unwrap<unknown>(payload);
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [value as T];
}

export type RequestOptions = Omit<AxiosRequestConfig, "url" | "method" | "data">;

/**
 * Identical GETs that are in flight at the same time share one request.
 *
 * Three CV sections read the same `GetHrAppEducationData` bundle, so one
 * screen would otherwise ask for it three times. This only merges *concurrent*
 * calls — nothing is cached once a request settles, so a read after a write
 * still goes to the server.
 */
const inFlight = new Map<string, Promise<unknown>>();

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> {
  const key = `${path}?${JSON.stringify(params ?? {})}`;
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = http
    .get(path, { ...options, params })
    .then((response) => unwrap<T>(response.data))
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
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
  options?: RequestOptions,
): Promise<T> {
  const response = await http.post(path, body, options);
  return unwrap<T>(response.data);
}

/**
 * POST a single file as `multipart/form-data`. The collection names the field
 * `file` for the profile picture.
 */
export async function apiUpload<T>(
  path: string,
  file: File,
  options?: RequestOptions & { fieldName?: string },
): Promise<T> {
  const form = new FormData();
  form.append(options?.fieldName ?? "file", file, file.name);
  const response = await http.post(path, form, options);
  return unwrap<T>(response.data);
}
