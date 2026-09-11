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
    // Agent worktrees are full copies of this project living inside it.
    // Without this, `bun run lint` lints the whole repo twice — 12,858
    // problems the first time this happened. CI never sees it, because CI
    // checks out fresh, so it only ever breaks locally.
    ".claude/worktrees/**",
  ]),

  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: GENERATED,
    plugins: { unicorn, "no-secrets": noSecrets },
    rules: {
      // Nesting. This is what rules out an `if` stacked inside an `if`
      // inside an `if` — the shape complexity limits also catch, but this
      // one is cheap and applies everywhere.
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 3],

      "no-secrets/no-secrets": "error",

      // `ignoreImports` because a third-party export name is not ours to
      // rename — `Geist_Mono` is the font package's, not a style choice.
      camelcase: ["error", { properties: "always", ignoreImports: true }],

      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "after-used", argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },

  {
    // Filenames. Kebab-case everywhere, hooks included.
    //
    // Two deliberate departures from pinecone: it uses PascalCase for
    // components and camelCase for hooks. This repo is kebab-case throughout
    // and the shadcn CLI generates kebab-case, so adopting PascalCase would
    // mean renaming ~40 files and then fighting the generator on every
    // `shadcn add`. One convention with no exceptions is also simply easier
    // to follow than three.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      ...GENERATED,
      // Owned by a teammate building the landing pages — see GOAL.md scope.
      // Renaming the directory under them would collide with work in
      // flight. Remove this line once that work has landed. (2026-09-11)
      "src/components/aboutUs/**",
    ],
    plugins: { unicorn },
    rules: { "unicorn/filename-case": ["error", { case: "kebabCase" }] },
  },

  {
    // The backend's field names are not ours: access_token, posname,
    // entryid, row_index. Renaming them at this boundary would mean
    // translating every payload twice.
    files: [
      "src/lib/api/**/*.ts",
      "src/server/mock/**/*.ts",
      "src/app/api/**/*.ts",
      "src/**/*.test.ts",
    ],
    rules: { camelcase: "off" },
  },
]);
