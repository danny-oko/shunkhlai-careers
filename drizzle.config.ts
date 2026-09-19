import type { Config } from "drizzle-kit";

// Generate SQL from src/lib/db/schema.ts:  bun run db:generate
// Push to the remote D1 database over HTTP:  bun run db:push
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
} satisfies Config;
