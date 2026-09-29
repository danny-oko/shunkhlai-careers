# Applications

What happens between an applicant pressing «Илгээх» and their application
existing in Shunkhlai's ERP.

**This site is not the system of record.** The ERP is. But the ERP is
frequently slow and sometimes unreachable, and an application that is only in
the ERP is an application that is lost whenever the ERP is down. So the site
keeps its own durable copy and pushes from it, and the two rules below are the
whole design:

1. **An application is never lost because the ERP was down.** It is committed
   to PostgreSQL before the ERP is called at all, and something always comes
   back for it — the applicant's next visit, or the sweep.
2. **An applicant is never told it succeeded when it did not.** The
   confirmation they get is the confirmation of the *local* write, and the
   copy to the ERP is shown separately and honestly.

## The order of operations

`POST /api/me/SaveHrRecruitmentOrderApp`
(`src/app/api/me/[...path]/route.ts`):

1. the handler adds the row to the applicant's document;
2. the row is stamped `pendingErp(...)` — `status: "pending"`, attempt 1, a
   `submittedAt`, and an idempotency key;
3. `saveAccount(...)` **commits it to PostgreSQL**;
4. the reply goes out — this is what the applicant sees, and it is true;
5. *only then* `after()` runs `syncTask`, which logs into the ERP and pushes.

Steps 3 and 5 are in that order on purpose. If the process dies between them,
the application exists, is `pending`, and is picked up later. If they were the
other way round, a slow ERP would be a slow apply button, and a dead ERP would
be a lost application.

## The state machine

On each application row, under `erp` (`ApplicationErp` in `erp-push.ts`; the
states are `PUSH_STATUSES` in `erp-retry.ts`):

| state | means | applicant sees |
|---|---|---|
| `pending` | ours, not yet in the ERP | Хадгалагдсан — ERP-д илгээгдэж байна |
| `sent` | the ERP has it | Илгээгдсэн |
| `failed` (retryable) | last push did not land; more tries coming | Хадгалагдсан — дахин илгээхийг оролдож байна |
| `failed` + `terminal` | nobody is trying any more | Анхаарал шаардлагатай |
| `skipped` | no ERP configured (mock mode) | nothing |

`pending → sent | failed | skipped`; `failed → sent | failed | failed+terminal`;
`failed+terminal → pending` **only** by an admin pressing retry. Every
transition goes through one function, `nextAppErp` in `erp-sync.ts`.

The row also carries `attempts`, `lastAttemptAt`, `claimedAt` (the lease),
`error` and `key`.

**`error` is always a short classified code, never an upstream message.** The
ERP's `retmsg` has been seen carrying the applicant's own name and register
number back at the caller; nothing from a response body is written to the
database or rendered. The codes are in `erp-retry.ts` and their Mongolian
wording is in `src/components/account/application-format.ts`.

## Retry policy

`classifyPushError` decides from the transport's own metadata — never from the
message:

| what came back | reason | retried? |
|---|---|---|
| no response (timeout, DNS, socket) | `erp_unreachable` | yes |
| 5xx, 429, 408 | `erp_unavailable` | yes |
| any other 4xx | `erp_apply_rejected` | **no** |
| 200 with `rettype ≠ 0` | `erp_apply_rejected` | **no** |
| anything not an `ErpError` | `erp_apply_failed` | yes |

Retrying a payload the ERP has refused does not eventually work; it just buries
the row for five more cycles. So a refusal goes terminal on the first attempt
and appears on the admin desk immediately.

Waiting reasons — `profile_incomplete`, `erp_withdraw_pending`,
`erp_link_refused`, `erp_register_busy` — are neither: nothing was sent, no
attempt is spent, and the row goes by itself once the applicant fills the gap.

**Backoff.** `retryDelayMs(attempts, key)` = `60s × 2^(attempts-1)`, capped at
one hour, jittered ±25%. So 1m, 2m, 4m, 8m, 16m, and never more than 75
minutes. `MAX_ATTEMPTS` is 5, counted at *claim* time, so a run that crashes
mid-push still spends its attempt and cannot loop forever.

The jitter is a hash of the row's idempotency key and the attempt number
rather than `Math.random()`. `isDue()` is a pure predicate that the claim, the
sweep and the desk all ask about the same row, and they have to agree; hashing
still does jitter's job of spreading a hundred rows that failed in the same
outage.

## Idempotency — exactly what is and is not guaranteed

The stable key is `idempotencyKey(email, recruitmentorderid)`: one applicant,
one posting. It is on the row from the moment it is created and survives every
retry, the sweep, and an admin retry.

**The ERP accepts no idempotency key.** `SaveHrRecruitmentOrderApp` takes
`recruitmentorderid`, `sourcetype`, `salrequest`, `poshiredate` and
`recsourceid` and nothing else (`applicationPayload`, `erp-push.ts`). There is
no `Idempotency-Key` header in the Postman collection and no request id in the
envelope. So the key above cannot be sent, and the guarantee has to be built
out of what the ERP does offer.

**What is guaranteed.**

- One application row is pushed by at most one process at a time. The claim is
  a `claimedAt` lease written inside `applicant_account`'s optimistic lock —
  the `UPDATE` carries `WHERE updated_at = <value read>` — so of two instances
  exactly one wins and the other reloads and skips the row.
- A retry does not resubmit an application the ERP is known to hold:
  `pushApplication` reads the ERP's own applied-posting list first
  (`appliedOrderIds` from `/get`) and returns `sent` without calling
  `SaveHrRecruitmentOrderApp`.
- The ERP's own duplicate refusal (`аль хэдийн…`) is treated as success, not
  as a failure, and the entry id is then recovered from
  `getRecruitmenRequestList`. So the *second* push of an application the ERP
  already has does not create a second one and does not leave the row stuck.
- No local duplicate is possible: `applicationPayload` is built from one row,
  and the row is keyed by posting in the applicant's own document.

**What is not guaranteed.**

- **Delivery is at-least-once, not exactly-once.** If a push commits in the ERP
  and the response is lost — a timeout after the write, a process killed
  mid-request — this side sees a retryable failure and will push again.
  Whether that creates a duplicate is then entirely the ERP's decision. In
  practice it refuses with «аль хэдийн», which is why the outcome is usually
  right; but that is **observed behaviour, not a contract**, and the site
  cannot enforce it.
- A lease older than `CLAIM_TTL_MS` (2 minutes) is reclaimed, so an instance
  that hangs mid-push for longer than the lease can have a second push start
  while its first is still on the wire. Same consequence as above.
- If the ERP ever gains an idempotency key, it plugs in at exactly one place:
  `applicationPayload` in `erp-push.ts`, using `erp.key` from the row. Nothing
  else has to change.

## No lost work on a crash

Three things pick a `pending` row back up, in increasing order of patience:

1. the `after()` task from the submit itself;
2. the applicant's next `/api/me` `get` — `syncDue()` retries anything due;
3. `sweepStuckApplications()` (`src/server/applicant/stuck.ts`), which scans
   the accounts and runs a sync for each one with a due row. It is bounded
   (`SWEEP_LIMIT`, 25 accounts a tick) and safe to run at any time.

**Under two instances:** both may start a sweep at the same moment. Both read
the same accounts; for each row, both try to claim; the optimistic lock lets
exactly one write the lease, the other gets `AccountConflictError`, reloads,
sees the fresh `claimedAt`, and claims nothing. So **two sweeps do not both
push the same application** — except in the reclaimed-lease window described
above, which is the at-least-once caveat and not a second mechanism.

## The desk

`/admin/applications` lists **every** application this site has seen, newest
first, with a detail view per row and a filter for status and posting. It
replaces the screen that was removed for showing only the failures: that one
was empty on a good day, and there was nowhere at all to answer "did Батболд's
application arrive".

**Where the rows come from, and the thing the page says out loud.** The ERP is
the system of record, and this desk would rather read it. It cannot. Every
endpoint in the collection that carries an application — `getRecruitmenRequestList`,
and the `recruitmentorders` inside `get` — answers for **one applicant**,
addressed by a bearer token `auth/login` mints from that applicant's регистр and
phone. There is no admin-scoped listing, and `/api/system/*` is the CMS, not
recruitment. So the list is the mirror (`applicant_account.data_json`), and the
page carries a banner saying so, together with the caveat that follows from it:
an application made straight to the ERP is not in this list.

The desk does make **one** ERP read — `getRecruitmentOrderList`, the public
posting list the careers pages use, no token and no applicant's credentials.
It answers whether the ERP is up at all and whether the posting somebody
applied to is still advertised. When it fails, every row stays on screen and
the banner changes to say the ERP was not reached; the reason is classified by
`classifyPushError`, exactly as a push failure is.

**PII.** The list shows a name, a posting, a date and the push state. No
регистр, no phone, no email — the detail view is addressed by the row's
idempotency key rather than by email so that no URL, bookmark or access log
carries one. The detail view adds the account email (HR's way to reach them)
and states whether a CV exists. Nothing upstream is ever rendered —
`erp.withdrawRefused` in the document and `application_log.error_message` in the
legacy table both hold raw `retmsg` text, and both are dropped by
`application-desk.ts`.

The applicant's own record is the one exception, and it is a separate read
behind a separate permission — see «The person behind the row» below.

**Roles.** Reading the desk is open to `editor` and `admin`. Two things are
`admin` only, both checked where they happen rather than only in the UI:
«Дахин илгээх», the one control with an effect outside this site
(`mayRetryApplications`), and the applicant's анкет and CV
(`mayViewApplicantData`) — both in `src/server/admin/guard.ts`.

## The person behind the row

The desk answers "did this application arrive". HR opens it for a second
reason: to read the candidate. So `/admin/applications/<key>` also carries the
applicant's анкет — everything they filled in at `/account/**` — their CV and
their photo.

**It is a second read, not a wider row.** `DeskApplication` and
`DeskApplicationDetail` still carry no регистр, no утас and no CV, because they
feed the list and the list is read over somebody's shoulder.
`getApplicantRecord(email)` in `src/server/applicant/applicant-record.ts` is a
separate call a caller has to make by name, and the page makes it only when
`mayViewApplicantData(user)` — `admin` — is true. An `editor` gets the desk and
one line saying why the rest is not there; the read never happens for them, so
there is nothing in the HTML to un-hide.

**What it shows.** The personal section, the address, the driving classes, the
two «Бусад» answers, both emergency contacts, and every repeating section:
боловсрол, гадаад хэл, компьютерийн ур чадвар, ажлын туршлага, гэр бүл,
сонирхсон ажлын байр. The four lists the ERP pulls in and this site has never
had a form for — `qualifications`, `projects`, `internships`, `relatives` — are
printed off whatever keys their rows turn out to have, under a dictionary label
or under the raw key: nothing documents their columns, and a value HR can read
under an odd label beats a value they never see.

The builder does every bit of the formatting — dates through the desk's own
`deskDate`, ERP reference codes (`/03/ Эгч`) stripped, ids and empty fields
dropped, `maritalstatus` resolved against the option list the last ERP pull
left in the document — so the component is a dumb renderer and the tests assert
on exactly what reaches the screen. Nothing upstream is copied: the document's
`erp` block is read for the marital list and for nothing else, and its
`withdrawRefused` never leaves it.

**The утас is a credential.** It is the applicant's ERP password
(`src/lib/api/README.md`) and the регистр is the other half of that login. They
are on the screen because HR cannot phone a candidate they have no number for,
and the screen says as much above them rather than leaving a reader to treat
the утас as an ordinary field.

**The files.** `GET /admin/applications/<key>/file/<cv|photo>` serves the bytes,
and it checks the session and the role itself. That is not belt-and-braces: a
route handler is a bare GET, no layout runs for it, and the page's own
`requireAdminUser()` protects nothing on that path — without the check, every
applicant's CV would be one guessable URL away. It is addressed by the
application's key for the same reason the detail page is, answers
`private, no-store` and `nosniff`, and never takes a name or a type from the
request. A PDF may be read in the browser (`?view=1` → `Content-Disposition:
inline`); anything else downloads, because a browser will not render a `.doc`
anyway and inline is not worth offering to a file whose stored type might not be
what its name claims. The applicant's own `/api/me/cv` is untouched and still
serves them their own file and nobody else's.

The machinery behind it is unchanged: `listStuckApplications`,
`retryApplication` and `sweepStuckApplications` are still exported from
`src/server/applicant/stuck.ts`, still tested, and still the retry policy's
home. The sweep still has no scheduler — an application whose applicant never
returns is picked up the next time that applicant loads `/api/me`, and
`terminal` rows wait for a person, on purpose.
