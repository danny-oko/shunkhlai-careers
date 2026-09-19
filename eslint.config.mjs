import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unicorn from "eslint-plugin-unicorn";
import noSecrets from "eslint-plugin-no-secrets";

/**
 * Two tiers.
 *
 * This file is the floor: rules the whole repository passes today, so `bun
 * run lint` is a real gate rather than a wall of pre-existing failures.
 *
 * `eslint.strict.config.mjs` is the bar: size and complexity limits applied
 * only to files a branch actually changes, via `bun run lint:strict`. New and
 * edited code is held to it; nothing forces a rewrite of code nobody touched.
 *
 * Modelled on ~/Documents/pinecone-monorepo, minus its Nx-specific rules.
 */

const GENERATED = [
  // The shadcn CLI regenerates these; hand edits vanish on the next `add`.
  "src/components/ui/**",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/worktrees/**",
  ]),

  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: GENERATED,
    plugins: { unicorn, "no-secrets": noSecrets },
    rules: {
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 3],

      "no-secrets/no-secrets": "error",

      camelcase: ["error", { properties: "always", ignoreImports: true }],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...GENERATED, "src/components/aboutUs/**"],
    plugins: { unicorn },
    rules: { "unicorn/filename-case": ["error", { case: "kebabCase" }] },
  },

  {
    files: [
      "src/lib/api/**/*.ts",
      "src/server/mock/**/*.ts",
      "src/app/api/**/*.ts",
      "src/**/*.test.ts",
    ],
    rules: { camelcase: "off" },
  },
]);
