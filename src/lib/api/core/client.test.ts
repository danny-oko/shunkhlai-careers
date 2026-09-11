// @vitest-environment jsdom

import axios, { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { http } from "./client";
import { isSignedIn, readAccessToken, readRefreshToken, storeSession } from "./tokens";

/**
 * The 401 → refresh → replay path.
 *
 * This is the one piece of the transport the mock backend cannot exercise: it
 * has no `/api/applicant/auth/refresh-token` (the Postman collection never
 * refreshes, so there is no example for it to mimic), and the tokens it issues
 * never expire. So the round trip is driven here instead — `http`'s adapter
 * stands in for the failing call, and the bare `axios.post` the interceptor
 * uses for the refresh itself is stubbed.
 *
 * What it pins down is the envelope. Every response from this service, the
 * refresh included, is `{ rettype, retmsg, retdata }`; the interceptor used to
 * hand that whole thing to `readTokenPair`, which reads `retdata`'s fields, so
 * it never found a token and treated a good refresh as a dead session.
 */

const ENVELOPE = { totalrow: 0, affectedrows: 1, retmsg: "", traceno: 0 };

/** Fails the first call with a 401, then succeeds — the replay is the point. */
function adapterFailingOnce(seen: string[]): AxiosAdapter {
  return async (config) => {
    seen.push(String(config.headers.Authorization));

    if (seen.length > 1) {
      return { status: 200, statusText: "OK", headers: {}, config, data: { ...ENVELOPE, rettype: 0, retdata: { ok: true } } };
    }

    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {}, {
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
      data: { ...ENVELOPE, rettype: 1, retmsg: "Нэвтрэх шаардлагатай.", retdata: null },
    });
  };
}

afterEach(() => {
  delete http.defaults.adapter;
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("401 → refresh → replay", () => {
  it("renews the session from the refresh envelope and replays the request", async () => {
    storeSession({ accessToken: "stale", refreshToken: "still-good" });

    const seen: string[] = [];
    http.defaults.adapter = adapterFailingOnce(seen);

    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: {
        ...ENVELOPE,
        rettype: 0,
        retdata: { access_token: "renewed", refresh_token: "renewed-refresh" },
      },
    });

    const response = await http.get("/api/applicant/get");

    expect(response.status).toBe(200);
    // The first attempt carried the stale token, the replay the renewed one.
    expect(seen).toEqual(["Bearer stale", "Bearer renewed"]);
    expect(readAccessToken()).toBe("renewed");
    expect(readRefreshToken()).toBe("renewed-refresh");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("does not take a token from a refusal the service delivers with HTTP 200", async () => {
    storeSession({ accessToken: "stale", refreshToken: "expired" });

    http.defaults.adapter = adapterFailingOnce([]);

    // `rettype` is non-zero, so this is a refusal — even though `retdata`
    // still carries something token-shaped. Unwrapping has to reject on
    // `rettype` before anything reads a token out of it.
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: {
        ...ENVELOPE,
        rettype: 1,
        retmsg: "Refresh token хүчингүй байна.",
        retdata: { access_token: "must-not-be-used" },
      },
    });

    await expect(http.get("/api/applicant/get")).rejects.toThrow();

    expect(readAccessToken()).not.toBe("must-not-be-used");
    expect(isSignedIn()).toBe(false);
  });

  it("gives up without calling the refresh endpoint when there is no refresh token", async () => {
    storeSession({ accessToken: "stale", refreshToken: null });

    http.defaults.adapter = adapterFailingOnce([]);
    const post = vi.spyOn(axios, "post");

    await expect(http.get("/api/applicant/get")).rejects.toThrow();

    expect(post).not.toHaveBeenCalled();
    expect(isSignedIn()).toBe(false);
  });
});
