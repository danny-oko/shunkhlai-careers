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
| `src/server/news/store.ts` — JSON on disk in development, memory in production | a table, or a CMS |
| `src/server/admin/session.ts` — one password, one signed cookie | `/auth/adminUserLogin` and the admin JWT tier already described in `src/lib/api/core/tokens.ts` |

Each is behind one seam. Pages never touch the store — they go through
`src/lib/news/service.ts`, seven `async` functions that exist purely so the
swap is one file. Nothing outside `session.ts` knows how the editor is
authenticated.

## Environment

Add these two to `.env` (and to `.env.example`, which this feature deliberately
did not edit — it is a fenced path):

```
# Password for /admin. Unset in development means the dev password below;
# unset in production means the admin desk is shut.
ADMIN_PASSWORD=

# Optional. Signs the admin session cookie. Derived from ADMIN_PASSWORD when
# absent, which is usually what you want.
ADMIN_SESSION_SECRET=
```

**`ADMIN_PASSWORD`**

- Set: that is the password.
- Unset, `NODE_ENV !== "production"`: falls back to `shunkhlai-dev` and warns
  once on startup. A fresh checkout can open `/admin` without any setup.
- Unset, `NODE_ENV === "production"`: **fails closed.** `adminLoginAvailable()`
  is false, every password check returns false, every session check returns
  false, and the login page says so rather than silently rejecting.

**`ADMIN_SESSION_SECRET`**

Leave it unset unless you have a reason. When absent the signing key is derived
from the password, which buys two things: a cookie survives a server restart,
so a dev-server reload does not sign the editor out mid-article; and rotating
`ADMIN_PASSWORD` invalidates every cookie already issued. Setting an explicit
secret gives up the second of those.

## The session

`shunkhlai.admin`, value `<expiry seconds>.<base64url HMAC>`, `httpOnly`,
`sameSite=lax`, `secure` in production, `path=/admin`, 8 hours.

`path=/admin` is the part worth keeping: the cookie is never attached to a
request for a public page, so nothing that caches or logs `/news` can capture
it. If you change it, change the logout action to match — a cookie cleared on
the wrong path stays exactly where it was.

Three checks, and they are not redundant:

1. `src/proxy.ts` redirects an unauthenticated navigation before anything
   renders. A proxy runs ahead of the app and can be bypassed, so this is a
   convenience, not the gate.
2. `requireAdmin()` in `src/app/admin/news/layout.tsx` — every page under it
   renders through this.
3. `requireAdmin()` as the first statement of every action in
   `src/app/admin/news/actions.ts`. A POST does not pass through a layout, so
   an action that trusted the layout would be an unauthenticated write endpoint.

## Storage

`.mock-data/news.json` (articles) and `.mock-data/news-media.json` (uploaded
covers, base64). Both gitignored. Development only — production is memory,
because the filesystem there is read-only.

Two files rather than one because a 4MB photograph is ~5.5MB of base64, and
`news.json` is rewritten on every single edit.

`{ seeded, articles }`, not a bare array. `seeded` is tracked separately from
`articles.length` on purpose: an editor who deletes every story has an empty
newsroom deliberately, and keying the seed off emptiness would resurrect all
seven on the next restart.

**To reset the desk:** delete `.mock-data/news.json` and restart. The seed is
re-laid on the next load.

## Covers

Served by `/api/news/media/[...key]`, never from `public/`:

- `med_<12 hex>` — uploaded through the editor, bytes in the store.
- `seed:brand/<file>` — a seeded story borrowing a file already in `public/`.
  Read-only; `public/brand/*` is a fenced path and is never written.

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

- All seven seeded articles in `src/server/news/seed.ts` — headlines,
  standfirsts, bodies, bylines and image descriptions. Every figure in them
  traces to `src/lib/company.ts`; no external partner, government body or
  financial figure appears anywhere. Speakers are unnamed internal roles.
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
