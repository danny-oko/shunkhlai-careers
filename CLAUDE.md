@AGENTS.md

# Shunkhlai careers

**Read `docs/ARCHITECTURE.md` before exploring the tree.** It maps every module,
the data flow, the environment variables and the commands — reading it is cheaper
and more accurate than grepping, and it is kept current.

These four are repeated here because they are the expensive ones to learn by
breaking; the rest live in that file.

1. **The database is shared between localhost and production.** A write from
   `next dev` is a write to live data. No repair-on-read logic, ever.
2. **User-facing strings are Mongolian**, error messages included.
3. **Never log or persist** a password, a token, or a CV body.
4. **`bun run test`, `bun run lint` and `bun run build` must pass** before a commit.
