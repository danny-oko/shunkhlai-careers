import { defineConfig } from "eslint/config";

import base from "./eslint.config.mjs";

/**
 * The bar, applied only to files a branch changes — see scripts/lint-changed.mjs.
 *
 * These two limits cannot be turned on repo-wide today: `complexity: 3` fails
 * 43 of ~60 source files, and one component scores 80. A number low enough to
 * be useful would fail the build; a number high enough to pass would mean
 * nothing. So the limits apply where they can actually be met — in code
 * someone is already editing — and the codebase ratchets toward them one file
 * at a time instead of in one unreviewable rewrite.
 *
 * Targets are pinecone's, except max-lines: 180 here against its 160.
 */
export default defineConfig([
  ...base,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/server/mock/**", "src/**/*.test.ts"],
    rules: {
      "max-lines": ["error", { max: 180, skipBlankLines: true, skipComments: true }],
      complexity: ["error", { max: 3 }],
    },
  },
  {
    // Components are arrow functions. Also here rather than in the floor:
    // 54 existing components are function declarations, and auto-fixing them
    // would rewrite the landing components a teammate is working in.
    //
    // Route files stay exempt — an async server component reads as
    // `export default async function Page()`, which is the framework's own
    // shape, not a style choice.
    files: ["src/components/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: {
      "react/function-component-definition": [
        "error",
        { namedComponents: "arrow-function", unnamedComponents: "arrow-function" },
      ],
    },
  },
]);
