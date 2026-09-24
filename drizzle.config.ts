import type { Config } from "drizzle-kit";

import { requireDatabaseUrl } from "./src/lib/db/url";

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
    // Same resolution the app uses, so a deployment whose connection string
    // arrives under a hosting provider's own variable name can still be
    // migrated without copying a live credential into a second variable.
    url: requireDatabaseUrl(),
  },
} satisfies Config;
