import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashSessionToken, looksLikeSessionToken, newSessionToken } from "./tokens";

/**
 * The cookie value and the column are two different strings, and this file is
 * where that stops being a claim: the hash is a real SHA-256, the token is
 * long enough to be unguessable, and neither can be mistaken for the legacy
 * `<expiry>.<signature>` stamp the guard also has to recognise.
 */

describe("newSessionToken", () => {
  it("is 43 base64url characters — 32 bytes, no padding, no dot", () => {
    const token = newSessionToken();

    expect(token).toMatch(/^[\w-]{43}$/u);
    expect(token).not.toContain(".");
    expect(token).not.toContain("=");
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newSessionToken()));
    expect(tokens.size).toBe(200);
  });
});

describe("hashSessionToken", () => {
  it("is the plain SHA-256 hex of the token", () => {
    const token = newSessionToken();

    expect(hashSessionToken(token)).toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
    expect(hashSessionToken(token)).toMatch(/^[\da-f]{64}$/u);
  });

  it("is stable for one token and different for another", () => {
    const a = newSessionToken();
    const b = newSessionToken();

    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });

  it("never contains the token it hashed", () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).not.toContain(token.slice(0, 8));
  });
});

describe("looksLikeSessionToken", () => {
  it("accepts a freshly minted token", () => {
    expect(looksLikeSessionToken(newSessionToken())).toBe(true);
  });

  it("rejects a legacy HMAC stamp, so it is never looked up as a token", () => {
    expect(looksLikeSessionToken("1790000000.abcdefghijklmnop")).toBe(false);
  });

  it("rejects junk, the empty string and a token of the wrong length", () => {
    const token = newSessionToken();

    for (const value of ["", "   ", "abc", `${token}A`, token.slice(0, 42), "{}", "../../etc"]) {
      expect(looksLikeSessionToken(value), value).toBe(false);
    }
  });
});
