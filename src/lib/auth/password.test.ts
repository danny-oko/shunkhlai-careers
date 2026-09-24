import { describe, expect, it } from "vitest";

import { hashPassword, passwordProblem, verifyPassword } from "./password";

/**
 * The hashing itself belongs to `@node-rs/argon2`; what is worth pinning here
 * is that this module never hands back the password, that two hashes of the
 * same password differ (a salt is in play), and that a wrong password and a
 * corrupt hash both come back false rather than throwing at the sign-in.
 */
describe("password hashing", () => {
  it("produces a salted argon2id PHC string, not the password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    const again = await hashPassword("correct horse battery staple");
    expect(again).not.toBe(hash);
  });

  it("verifies the right password and refuses the wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "Correct horse battery staple")).resolves.toBe(false);
  });

  it("answers false for a hash that is not one", async () => {
    await expect(verifyPassword("not-a-hash", "correct horse battery staple")).resolves.toBe(false);
  });

  it("refuses a password too short to be one", async () => {
    expect(passwordProblem("short")).toMatch(/at least 12/u);
    expect(passwordProblem("long enough to pass")).toBeNull();
    await expect(hashPassword("short")).rejects.toThrow(/at least 12/u);
  });
});
