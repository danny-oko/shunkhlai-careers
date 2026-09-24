# Newsroom

The `/news` front page, the article pages under it, and the `/admin` desk that
fills them. Self-contained: nothing here talks to the recruitment backend.

## Why it is not part of the API layer

The Postman collection has no news endpoints, and no admin login. There is
nothing to bind to and nothing to mock. So the newsroom stores its own content
and authenticates its own editor, and it does that in files that sit beside
`src/lib/api/**` rather than inside it — the fenced transport layer is
untouched by this feature.

That means two things are local decisions rather than backend contracts, and
both are meant to be replaced:

| Today | When the backend grows one |
|---|---|
| `src/server/news/store.ts` — two tables in PostgreSQL (`news_article`, `news_media`) | a CMS, if one is ever wanted |
| `src/server/admin/*` — staff accounts in `app_user`, sessions in `admin_session` | `/auth/adminUserLogin` and the admin JWT tier already described in `src/lib/api/core/tokens.ts` |

Each is behind one seam. Pages never touch the store — they go through
`src/lib/news/service.ts`, seven `async` functions that exist purely so the
swap is one file. Nothing outside `src/server/admin/*` knows how the editor is
authenticated.

## Signing in

Staff sign in at `/admin/login` with **an email and a password**, checked with
argon2id against `app_user`. Accounts are made with
`bun run user:create` (see `docs/postgres.md`), and an account with
`is_active = false` cannot sign in.

The refusal is one sentence — `И-мэйл эсвэл нууц үг буруу байна.` — for an
unknown address, a wrong password and a deactivated account alike. Three
different messages would answer, for anyone who cared to ask, whether an
address has an account here.

Timing says as little as the message: an address with no account is still
verified against a decoy argon2id hash, so "no such user" costs what "wrong
password" costs. Without that, a stopwatch is a second error message.

### Two brakes, pulling opposite ways

A single counter cannot do this job, and an earlier version of this slice
shipped one that could be defeated in both directions at once. So there are
two (`src/server/admin/rate-limit.ts`):

| | keyed on | what it does | armed when |
|---|---|---|---|
| refusal | address | 10 failures in 15 minutes and that address is turned away outright | only with a trustworthy address |
| throttle | email | after 3 failures the answer is delayed, doubling to 2s | always |

The email half is **a delay and never a refusal**. That is the property that
matters: anybody can fail on anybody's behalf, so a counter that refused would
let a stranger lock a real admin out of their own account for fifteen minutes,
over and over. A delay slows guessing from ~50 tries a second to under one
while a correct password still signs in on the first go.

Both counters are a `Map` in the Node process: lost on restart, not shared
between instances. Brakes sized for one `next start`, and the first thing to
move to the database if the app is ever run as more than one process.

### `TRUST_PROXY_HEADERS`

```
# Set to "true" ONLY when a reverse proxy in front of this app rewrites
# X-Forwarded-For. Unset means no client address is trusted.
TRUST_PROXY_HEADERS=
```

`X-Forwarded-For` is written by whoever is talking to us. Believing it
unconditionally is worth nothing and costs two attacks: rotate the header and
the per-address counter never fires, or put someone else's address in it and
that person is the one refused. Both were demonstrated against an earlier
version of this code.

So the header is read only when this variable says a proxy is in front — the
customer's nginx deployment sets it; a direct `next start` does not. And the
**last** entry is used, not the first: nginx's `$proxy_add_x_forwarded_for`
appends to whatever arrived, so the left of the list is the client's own
invention and only the right was written by our own proxy.

With no trusted address the per-address refusal is simply disarmed. The email
throttle does not depend on an address, so guessing is still slowed to a crawl.

### The fallback (`ADMIN_PASSWORD`)

**If `app_user` has no rows at all**, the old shared-password login still
works, so a fresh deployment is not locked out before anyone has created the
first account. It logs a warning on every use. The check is "the table is
empty", not "this email is unknown" — the moment one account exists the
fallback is closed, for cookies already issued as well as for new sign-ins.

```
# Only used while app_user is empty. Unset in development means the dev
# password below; unset in production means that fallback is shut.
ADMIN_PASSWORD=

# Optional. Signs the fallback's cookie. Derived from ADMIN_PASSWORD when
# absent, which is usually what you want.
ADMIN_SESSION_SECRET=
```

- `ADMIN_PASSWORD` set: that is the fallback password.
- Unset, `NODE_ENV === "development"`: falls back to `shunkhlai-dev` and warns
  once on startup, so a fresh checkout can open `/admin` with no setup at all.
- Unset, anything else — production, staging, a test runner, **or a
  `next start` under a service manager that never set NODE_ENV**: fails
  closed. It is `=== "development"` rather than `!== "production"` on purpose;
  with `app_user` empty that constant would otherwise open the whole account
  system on a box nobody thought of as a development machine.

## The session

`shunkhlai.admin`, `httpOnly`, `sameSite=lax`, `secure` in production,
`path=/admin`, 8 hours — the same cookie as before, carrying a different value:

- a **staff session**: 43 base64url characters, 32 random bytes, meaning
  nothing on their own. `admin_session` holds one row per live cookie with
  `sha256(token)` in `token_hash` — never the token, so a database dump cannot
  be replayed as a session — plus `user_id`, `expires_at` and `created_at`.
- the **fallback**: the old self-describing `<expiry>.<base64url HMAC>` stamp,
  which has no row to point at. The two are told apart by shape.

Server-side is the point: a row can be deleted. Logging out deletes it,
changing a password deletes every session the user has, and switching an
account off (`is_active = false`) makes its live sessions stop working at the
next request rather than at the next sign-in. Expired rows are refused, deleted
when they are noticed, and swept on each successful sign-in.

`path=/admin` is the part worth keeping: the cookie is never attached to a
request for a public page, so nothing that caches or logs `/news` can capture
it. If you change it, change the logout action to match — a cookie cleared on
the wrong path stays exactly where it was.

Three checks, and they are not redundant:

1. `src/proxy.ts` redirects an unauthenticated navigation before anything
   renders. It checks the cookie's *shape* only — a proxy has no business
   opening a database pool per request — so it is a convenience, not the gate.
2. `requireAdmin()` in `src/app/admin/news/layout.tsx` — every page under it
   renders through this, and this is the check that loads the session.
3. `requireAdmin()` as the first statement of every action in
   `src/app/admin/news/actions.ts`. A POST does not pass through a layout, so
   an action that trusted the layout would be an unauthenticated write endpoint.

`requireAdmin()` still returns `Promise<void>`, so those callers did not
change. `currentAdmin()` returns the signed-in user (`id`, `name`, `email`,
`role`, and `source`, which says whether they came through `app_user` or the
fallback) or null; `requireAdminUser()` is the gate that hands that identity
back. A database that cannot be reached means no identity — the desk shuts
rather than opens.

## Changing a password

`/admin/account` shows who is signed in and takes a password change: current
password, then the new one twice, minimum 12 characters. The current password
is required even though the session already proves who this is — otherwise an
unattended, still-signed-in browser is a permanent handover of the account.

Every session for that user is dropped and a fresh one opened for the browser
doing the changing. A password change whose point is to lock someone out, with
the cookie they hold left working, would not lock anyone out.

Changing a password is throttled on the same per-email counter as the login
form — it is a password check too, and a session someone walked away from
could otherwise be used to grind the real password at one try per
verification. The three writes (drop every session, write the hash, open one
fresh session) are **one transaction**: as separate statements, a crash
between them could leave the old sessions valid against the new password,
which is the one thing a password change exists to prevent.

Creating and deactivating accounts is not in the UI: that is
`bun run user:create` and SQL, for now.

## Roles

`app_user.role` is `admin` or `editor`, and they differ on exactly one thing:

- **editor** — may create and edit stories, publish, unpublish and feature.
- **admin** — all of that, and may **delete**.

Deleting is the only irreversible control on the desk; a bad edit can be
edited again. The rule is `mayDeleteArticles()` in `src/server/admin/guard.ts`,
checked inside `deleteArticleAction` — not only in the UI, because a POST does
not come through the UI. An editor does not get the button drawn either, and
is sent to `/admin/news?error=forbidden` if they post one anyway.

The `ADMIN_PASSWORD` fallback identity counts as an admin: it is a fresh
deployment's only way in, and exists precisely so somebody can still do
everything.

## Storage

PostgreSQL, through the same Drizzle client (`getDb()` in `src/lib/db`) as the
applicant account — see `docs/postgres.md`. **Every host pointed at the same
`DATABASE_URL` shares the rows**, so what a `bun run dev` against the
production connection string saves is a production edit; a local
`docker compose up` gives you a database of your own instead.

- `news_article` — one row per story. `body_json` is a `RichDoc` in a `jsonb`
  column; rows written before rich text hold a `NewsBlock[]`, which
  `coerceBody` reads on the way out, so no migration is needed. `featured` is
  a real boolean and `created_at` / `updated_at` are `timestamptz`, which
  `store.ts` converts to the ISO strings `NewsArticle` promises.
  `published_at` stays TEXT: it is an editorial `YYYY-MM-DD` and a lexical
  sort of it is the chronological one.
- `news_media` — uploaded covers as base64, chunked at 500k characters per
  row. The chunking came from D1's 2 MB value cap and is kept so the rows
  carried over still read back.

The DDL is the one initial migration in `drizzle/`; `schema.ts` is what
generated it.

Nothing in the store caches or seeds. The public pages and the desk are
`force-dynamic` and query the database on every request, which is the only way
an edit made from another host shows up here; the admin actions also call
`revalidatePath` for `/news`, the story's old and new URL, and `/admin/news`,
which clears the editor's own client router cache.

**Content:** `bun scripts/news/sync.ts [--dry-run] [--force]` wrote the owner's
articles (`scripts/news/articles.source.json`, pictures mapped in
`scripts/news/images.json`) into the old D1 database and set the seven
placeholder rows to draft. It is kept as the record of how those rows were
laid down and **still speaks SQLite to D1** — it has not been ported. The rows
themselves come across with `bun scripts/db/d1-to-postgres.ts`.

## Covers

`coverKey` is one of:

- an absolute `https://` URL — normally Cloudinary. `coverUrl()` returns it
  unchanged and the page links to it directly; the media route never fetches
  or proxies a URL. `next/image` optimises `res.cloudinary.com` (see
  `images.remotePatterns`); any other https host is rendered `unoptimized`.
  Editors can paste one in the "Зургийн холбоос (URL)" field; an uploaded
  file wins over a URL, a URL over "remove".
- `med_<12 hex>` — uploaded through the editor, bytes in `news_media`, served
  by `/api/news/media/[...key]`.
- `seed:brand/<file>` — an old placeholder borrowing a file already in
  `public/`. Read-only; `public/brand/*` is a fenced path and is never written.

A catch-all route, not `[key]`, because `seed:` keys contain a slash and
servers disagree about whether `%2F` inside one dynamic segment is an escaped
character or a separator. Joining the segments is correct under either reading.

Containment is enforced in `readSeedMedia`: the path is resolved and then
checked to still be inside `public/` before anything is opened. A relative path
that climbs out, an absolute path and a NUL-stuffed one all fail the same test.

### Known content gap

**Every image in `public/brand/` is a campaign key visual, not a photograph.**
They carry baked-in Mongolian headline type across the lower third, and the
`mock-*.jpg` files are numbered placeholder tiles with no picture in them at
all. The seed uses the least poster-like of them and `NewsCover` crops from
22% down the frame to land on the subject rather than on the type — but this
is damage control, not a solution.

The newsroom needs real editorial photographs. Until HR supplies them, treat
the covers on `/news` as placeholder.

## The body syntax

Articles are stored as a `NewsBlock[]`, and the editor is a `<textarea>` over a
four-rule line syntax (`src/lib/news/blocks.ts`):

```
## Дэд гарчиг
> Ишлэл — Хэлсэн хүн
- Жагсаалтын мөр
anything else is a paragraph
```

Blank lines separate blocks; soft-wrapped lines inside a paragraph join with a
space. `parseBody(serializeBody(blocks))` round-trips, which is what lets the
editor open a stored article, and what lets the preview pane be the real thing
rather than an approximation — it renders the same `<ArticleBody>` the public
page does, off the same blocks.

No rich-text editor, deliberately: it is a dependency, a security surface, and
a second representation to keep in sync with the first.

## Copy for review

**TODO(HR): everything below is placeholder, pending review.**

- The `alt` text on gallery pictures in `scripts/news/images.json` (the
  captions are the owner's; the alt descriptions were written for this sync).
- The masthead line "Компанийн сурвалжилга · Салбарын мэдээ · Хүний нөөц" and
  the nameplate "Шунхлай Мэдээ" (`src/components/news/masthead.tsx`).
- The four desk names — Компани, Салбар, Нийгэм, Хүний нөөц
  (`NEWS_CATEGORIES` in `src/lib/news/types.ts`). Changing a `value` here
  orphans existing articles; changing a `label` is safe.
- Validation messages in `src/lib/news/schema.ts`.
- Admin screen copy in `src/app/admin/**` and `src/components/admin/**`,
  including the sign-in failure "Нууц үг буруу байна."
- Empty and 404 states in `src/app/news/page.tsx` and
  `src/app/news/not-found.tsx`.

## Dates

`formatNewsDate` builds the Mongolian long form and picks the ordinal month
suffix from a table, because vowel harmony follows the month's spoken name and
cannot be derived from the number: 1, 4, 9 and 11 take **дүгээр**, the rest
**дугаар**.

"Today" comes from `todayInUlaanbaatar()`, not `toISOString()`. Mongolia is
UTC+8, so from 16:00 local the UTC date is yesterday's, and the masthead would
print the wrong day every evening.
