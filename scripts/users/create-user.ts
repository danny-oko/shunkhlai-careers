/**
 * Creates a user in `app_user` (the customer's guide, section 2).
 *
 *   bun scripts/users/create-user.ts --email admin@shunkhlai.mn --name "Admin" [--role admin]
 *
 * The password is asked for at the terminal, twice, with the echo off. It is
 * never an argument — an argv password is in the shell history, in `ps`, and
 * in every CI log — and it is never printed, not even masked. What reaches the
 * database is the argon2id hash from `src/lib/auth/password.ts`.
 *
 * Nothing in the app reads this table yet: `/admin` still signs in with
 * ADMIN_PASSWORD. This script exists so the rows are there when that login is
 * moved onto the table.
 *
 * Needs `DATABASE_URL`. Bun loads `.env.local` itself.
 */
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

import { eq } from "drizzle-orm";

import { hashPassword, passwordProblem } from "../../src/lib/auth/password";
import { appUser } from "../../src/lib/db/schema";
import { openDb } from "../db/client";

const ROLES = new Set(["admin", "editor"]);

function flag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/**
 * One line from the terminal with the echo off.
 *
 * `_writeToOutput` is readline's own hook for this; the prompt is written
 * before it is muted so the operator can still see what is being asked. A
 * pipe is refused rather than read: a password arriving on stdin from a script
 * is a password sitting in that script.
 */
function readSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    fail("Refusing to read a password from a pipe. Run this in a terminal.");
  }
  process.stdout.write(question);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const email = (flag("email") ?? "").trim().toLowerCase();
const name = (flag("name") ?? "").trim();
const role = (flag("role") ?? "admin").trim();

if (!email || !email.includes("@")) fail("Usage: --email <address> --name <name> [--role admin]");
if (!name) fail("Usage: --email <address> --name <name> [--role admin]");
if (!ROLES.has(role)) fail(`Unknown role "${role}". Use one of: ${[...ROLES].join(", ")}`);

const password = await readSecret(`Password for ${email}: `);
const problem = passwordProblem(password);
if (problem) fail(problem);
const again = await readSecret("Repeat it: ");
if (again !== password) fail("The two passwords did not match. Nothing was written.");

const { db, close } = openDb();
try {
  const existing = await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.email, email));
  if (existing.length > 0) {
    fail(`${email} already exists. This script only creates; change a password in SQL for now.`);
  }

  await db.insert(appUser).values({
    id: `usr_${randomBytes(8).toString("hex")}`,
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    isActive: true,
    createdAt: new Date(),
  });
  console.log(`Created ${email} (${role}).`);
} finally {
  await close();
}
