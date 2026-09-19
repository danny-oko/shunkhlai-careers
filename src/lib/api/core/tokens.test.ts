// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSession,
  isSignedIn,
  onSessionChange,
  readAccessToken,
  readRefreshToken,
  readTokenPair,
  storeSession,
  tokenExpiry,
} from "./tokens";

/** An unsigned JWT with the given claims — only the payload is ever read. */
function jwt(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

afterEach(() => {
  window.localStorage.clear();
});

describe("storage keys", () => {
  // These exact strings are load-bearing: tokens written by an earlier build
  // must still be readable after a deploy. Renaming a key silently signs
  // every existing visitor out, so the names are asserted literally.
  it("reads an applicant token left behind by a previous build", () => {
    window.localStorage.setItem("shunkhlai.token", "old-access");
    window.localStorage.setItem("shunkhlai.refreshToken", "old-refresh");

    expect(readAccessToken()).toBe("old-access");
    expect(readRefreshToken()).toBe("old-refresh");
  });

  it("writes applicant tokens under the documented keys", () => {
    storeSession({ accessToken: "a", refreshToken: "r" });

    expect(window.localStorage.getItem("shunkhlai.token")).toBe("a");
    expect(window.localStorage.getItem("shunkhlai.refreshToken")).toBe("r");
  });

  it("writes admin tokens under separate keys", () => {
    storeSession({ accessToken: "a", refreshToken: "r" }, "admin");

    expect(window.localStorage.getItem("shunkhlai.adminToken")).toBe("a");
    expect(window.localStorage.getItem("shunkhlai.adminRefreshToken")).toBe("r");
  });
});

describe("audience isolation", () => {
  it("defaults to the applicant audience", () => {
    storeSession({ accessToken: "applicant-token", refreshToken: null });

    expect(readAccessToken("applicant")).toBe("applicant-token");
    expect(readAccessToken()).toBe("applicant-token");
  });

  it("does not let an admin session satisfy an applicant read", () => {
    storeSession({ accessToken: "admin-token", refreshToken: null }, "admin");

    expect(readAccessToken("admin")).toBe("admin-token");
    expect(readAccessToken("applicant")).toBeNull();
    expect(isSignedIn("applicant")).toBe(false);
  });

  it("clears only the audience it was asked to clear", () => {
    storeSession({ accessToken: "applicant", refreshToken: null });
    storeSession({ accessToken: "admin", refreshToken: null }, "admin");

    clearSession("applicant");

    expect(isSignedIn("applicant")).toBe(false);
    expect(isSignedIn("admin")).toBe(true);
  });
});

describe("storeSession", () => {
  it("leaves an existing refresh token alone when given none", () => {
    // A login response may omit the refresh token; a null must not erase
    // the one already stored.
    storeSession({ accessToken: "first", refreshToken: "keep-me" });
    storeSession({ accessToken: "second", refreshToken: null });

    expect(readAccessToken()).toBe("second");
    expect(readRefreshToken()).toBe("keep-me");
  });
});

describe("clearSession", () => {
  it("removes both tokens for the audience", () => {
    storeSession({ accessToken: "a", refreshToken: "r" });

    clearSession();

    expect(readAccessToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
    expect(isSignedIn()).toBe(false);
  });
});

describe("onSessionChange", () => {
  it("notifies subscribers on sign-in and sign-out with the audience", () => {
    const listener = vi.fn();
    const unsubscribe = onSessionChange(listener);

    storeSession({ accessToken: "a", refreshToken: null }, "admin");
    clearSession("admin");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, "admin");
    expect(listener).toHaveBeenNthCalledWith(2, "admin");

    unsubscribe();
    storeSession({ accessToken: "b", refreshToken: null });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("readTokenPair", () => {
  it("reads the snake_case pair the login endpoint returns", () => {
    expect(
      readTokenPair({ access_token: "access", refresh_token: "refresh" }),
    ).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  it("accepts the camelCase spelling too", () => {
    expect(
      readTokenPair({ accessToken: "access", refreshToken: "refresh" }),
    ).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  it("returns a pair with a null refresh token when only an access token is sent", () => {
    expect(readTokenPair({ access_token: "access" })).toEqual({
      accessToken: "access",
      refreshToken: null,
    });
  });

  it.each([
    ["null", null],
    ["a string body", "access_token=abc"],
    ["an empty object", {}],
    ["an empty access token", { access_token: "" }],
    ["a non-string access token", { access_token: 12345 }],
  ])("returns null for %s", (_label, retdata) => {
    expect(readTokenPair(retdata)).toBeNull();
  });
});

describe("token expiry", () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("reads exp from a JWT", () => {
    expect(tokenExpiry(jwt({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it("has no expiry for a token that is not a JWT", () => {
    expect(tokenExpiry("mock.1.abc")).toBeNull();
    expect(tokenExpiry("opaque")).toBeNull();
    expect(tokenExpiry(jwt({ sub: "1" }))).toBeNull();
  });

  it("keeps a token that has not expired", () => {
    const token = jwt({ exp: nowSeconds() + 3600 });
    storeSession({ accessToken: token, refreshToken: null });

    expect(readAccessToken()).toBe(token);
    expect(isSignedIn()).toBe(true);
  });

  it("signs out once the token has expired, and says so", () => {
    storeSession({ accessToken: jwt({ exp: nowSeconds() - 1 }), refreshToken: "r" });
    const listener = vi.fn();
    const unsubscribe = onSessionChange(listener);

    expect(isSignedIn()).toBe(false);
    expect(readRefreshToken()).toBeNull();
    expect(listener).toHaveBeenCalledWith("applicant");

    unsubscribe();
  });
});
