import { defineConfig } from "drizzle-kit";

/**
 * `db:generate` only needs the schema and an output folder — it diffs the
 * schema against the previous snapshot and writes SQL into `migrations/`,
 * which `wrangler d1 migrations apply` then runs. Wrangler owns applying
 * migrations; drizzle-kit only writes them.
 *
 * The credentials are for `drizzle-kit studio` against the remote database,
 * and are read from the environment so nothing lands in this file.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
