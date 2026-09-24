import { afterEach, describe, expect, it } from "vitest";

import { poolConfig, requireDatabaseUrl, sslFromUrl } from "./url";

const original = process.env.DATABASE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
});

/**
 * The customer's Postgres is on a private network with no certificate, so the
 * default has to be plain TCP — but a deployment that does have TLS must be
 * able to ask for it in the URL alone, without a code change.
 */
describe("sslFromUrl", () => {
  it("is off by default and when the mode says disable", () => {
    expect(sslFromUrl("postgresql://u:p@host:5432/app_db")).toBeUndefined();
    expect(sslFromUrl("postgresql://u:p@host:5432/app_db?sslmode=disable")).toBeUndefined();
  });

  it("encrypts without verifying for require/prefer and ssl=true", () => {
    const relaxed = { rejectUnauthorized: false };
    expect(sslFromUrl("postgresql://u:p@host/app_db?sslmode=require")).toEqual(relaxed);
    expect(sslFromUrl("postgresql://u:p@host/app_db?sslmode=prefer")).toEqual(relaxed);
    expect(sslFromUrl("postgresql://u:p@host/app_db?ssl=true")).toEqual(relaxed);
  });

  it("keeps verification on for verify-ca / verify-full", () => {
    const strict = { rejectUnauthorized: true };
    expect(sslFromUrl("postgresql://u:p@host/app_db?sslmode=verify-full")).toEqual(strict);
    expect(sslFromUrl("postgresql://u:p@host/app_db?sslmode=verify-ca")).toEqual(strict);
  });
});

describe("requireDatabaseUrl", () => {
  it("says which variable is missing rather than failing at connect time", () => {
    delete process.env.DATABASE_URL;
    // The message names DATABASE_URL first and then the hosting providers'
    // own variable names it also accepts - see `requireDatabaseUrl`.
    expect(() => requireDatabaseUrl()).toThrow(/Set DATABASE_URL/u);
  });

  it("carries the URL and its SSL choice into the pool options", () => {
    process.env.DATABASE_URL = "postgresql://u:p@host:5432/app_db?sslmode=require";
    const config = poolConfig();
    expect(config.connectionString).toContain("host:5432/app_db");
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });
});
