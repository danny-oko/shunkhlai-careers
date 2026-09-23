import type { Config } from "drizzle-kit";

// Generate SQL from src/lib/db/schema.ts:  bun run db:generate
// Apply it to the database in DATABASE_URL:  bun run db:push
//
// The D1 history is gone on purpose: that database is being abandoned, so
// `drizzle/` holds one clean initial PostgreSQL migration instead of a
// replayed SQLite past. See docs/postgres.md.
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
