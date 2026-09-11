#!/usr/bin/env node
/**
 * Runs the strict ruleset over the files this branch changes.
 *
 * The repo-wide config is a floor everything already passes. This is the bar
 * for anything you touch: edit a file, and it has to meet the size and
 * complexity limits before the branch lands. Legacy code nobody opened is left
 * alone.
 *
 * Usage: bun run lint:strict [baseRef]   (default: origin/main, then main)
 */
import { execFileSync, spawnSync } from "node:child_process";

const EXTENSIONS = /\.(ts|tsx)$/;
const SCOPE = /^src\//;

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function resolveBase(requested) {
  if (requested) return requested;
  for (const ref of ["origin/main", "main"]) {
    try {
      git("rev-parse", "--verify", "--quiet", ref);
      return ref;
    } catch {
      // Try the next one — a fresh clone may have neither.
    }
  }
  return null;
}

const base = resolveBase(process.argv[2]);
if (!base) {
  console.log("lint:strict — no base ref to diff against, nothing to check.");
  process.exit(0);
}

/**
 * Everything this branch touches: committed against the base, plus whatever
 * is still in the working tree. Without the second and third sources an
 * uncommitted edit would pass a check it should fail — which is exactly when
 * you want to hear about it.
 */
function changedFiles(baseRef) {
  const sources = [
    // Three-dot: what this branch changed, not what main gained meanwhile.
    git("diff", "--name-only", "--diff-filter=d", `${baseRef}...HEAD`),
    // Staged and unstaged, against HEAD.
    git("diff", "--name-only", "--diff-filter=d", "HEAD"),
    // New files that have never been committed.
    git("ls-files", "--others", "--exclude-standard"),
  ];

  return [...new Set(sources.join("\n").split("\n"))]
    .filter((file) => file && SCOPE.test(file) && EXTENSIONS.test(file))
    .sort();
}

const changed = changedFiles(base);

if (changed.length === 0) {
  console.log(`lint:strict — no source files changed against ${base}.`);
  process.exit(0);
}

console.log(`lint:strict — ${changed.length} changed file(s) against ${base}:`);
for (const file of changed) console.log(`  ${file}`);

const result = spawnSync(
  "bunx",
  ["eslint", "--config", "eslint.strict.config.mjs", ...changed],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
