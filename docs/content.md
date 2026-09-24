# Editable page content

The marketing copy that used to be constants in the components is a row in
`site_content` now, edited at `/admin/content` behind the same
`requireAdmin()` gate as the newsroom.

Three sections, one row each:

| key | what it is | where it shows |
|---|---|---|
| `hero` | heading, the campaign slides (`src`, `caption`, `alt`), the two CTA labels and their links | `/` |
| `footer` | the registered address, its map link, and the contact rows (`label`, `value`, optional `href`) | every page |
| `about_stats` | the section heading and the ordered `{value, label}` figures | `/about` |

Each has a zod schema in `src/lib/content/schema.ts`, and every read and every
write goes through it. A row that does not match is not rendered.

## The fallback is the point

`getContent(key)` **always answers**. An unwritten row, a row that fails its
schema and a database that is not responding all end at the same place: the
value in `src/lib/content/defaults.ts`, which is the copy those components
shipped with, transcribed. So an empty `site_content` renders exactly the site
that was there before this feature, and an outage never blanks a page.

The row is taken whole or not at all — no merging a good half of a bad
document into the defaults, which would give this year's heading over last
year's figures with nothing to show which is which.

The admin desk deliberately does *not* fall back: if the database is down it
says so, because a form pre-filled with the defaults would overwrite the real
rows on save.

## Freshness

The public pages read the database on render, so a save shows up on the next
load. `saveSectionAction` still calls `revalidatePath` for two caches it
cannot otherwise reach: the browser's client router cache, and `/`'s
five-minute ISR window (the home page is `revalidate = 300` for the
recruitment API, not `force-dynamic`). The footer revalidates as a `layout`,
because it is on every page.

## Images

Uploads are **signed server-side**. The browser posts the file to
`POST /admin/upload` — under `/admin` because the admin session cookie is
scoped `path=/admin` — which checks the session, then `src/server/media/cloudinary.ts`
signs and performs the upload and answers with the `secure_url` to store.

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  server-side only. Never `NEXT_PUBLIC_*`: that prefix compiles into the
  browser bundle.
- No unsigned upload preset. An unsigned preset in the page source is a public
  write endpoint on the company's media account.
- Everything is filed under `shunhlai/` (`shunhlai/hero`, `shunhlai/news`).
- The limits are the repo's existing ones, from
  `src/lib/news/shared/limits.ts`: JPEG, PNG, WebP or AVIF, up to 8 MB.
- A route rather than a server action, because Next caps a server-action body
  at 1 MB — which is why the newsroom's own cover upload has to downscale to
  600 KB first (`src/components/admin/cover-upload.ts`). Both ways of setting
  a news cover are still there; the upload button fills the "image link" field.

Missing variables are not fatal: `cloudinaryConfig()` returns null, the upload
button reports it, and an admin can still paste a URL.

## Migration

`drizzle/0001_loud_chimera.sql` creates the table. `bun run db:push` (or
`bun run db:migrate`) applies it; see `docs/postgres.md`.
