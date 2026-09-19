// @vitest-environment jsdom

import axios, { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { http } from "./client";
import { isSignedIn, storeSession } from "./tokens";

/**
 * A 401 ends the session — nothing is refreshed or replayed.
 *
 * The Postman collection never calls a refresh endpoint; when its token stops
 * working the tester signs in again. The live service answers a dead token
 * with HTTP 401 and a plain-text "Invalid token" body, which is what the
 * adapter below reproduces.
 */

function adapterAnswering(status: number, seen: string[]): AxiosAdapter {
  return async (config) => {
    seen.push(String(config.headers.Authorization));
    const response = { status, statusText: "", headers: {}, config, data: "Invalid token" };
    throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, response);
  };
}

afterEach(() => {
  delete http.defaults.adapter;
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("401 handling", () => {
  it("clears the session without calling any refresh endpoint", async () => {
    storeSession({ accessToken: "stale", refreshToken: "unused" });
    const seen: string[] = [];
    http.defaults.adapter = adapterAnswering(401, seen);
    const post = vi.spyOn(axios, "post");

    await expect(http.get("/api/applicant/get")).rejects.toThrow();

    expect(seen).toEqual(["Bearer stale"]);
    expect(post).not.toHaveBeenCalled();
    expect(isSignedIn()).toBe(false);
  });

  it("keeps the session on other failures", async () => {
    storeSession({ accessToken: "good", refreshToken: null });
    http.defaults.adapter = adapterAnswering(500, []);

    await expect(http.get("/api/applicant/get")).rejects.toThrow();

    expect(isSignedIn()).toBe(true);
  });

  it("leaves the session alone when a public read is refused", async () => {
    storeSession({ accessToken: "good", refreshToken: null });
    const seen: string[] = [];
    http.defaults.adapter = adapterAnswering(401, seen);

    await expect(http.get("/api/applicant/getDropDownData", { skipAuth: true })).rejects.toThrow();

    expect(seen).toEqual(["undefined"]);
    expect(isSignedIn()).toBe(true);
  });
});
