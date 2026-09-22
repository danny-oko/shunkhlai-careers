# Recruitment API layer

Everything the app knows about the recruitment backend lives here. It is
modelled on the Postman collection **“Careers Web API — Үндсэн”**, whose saved
example responses are the source of truth for every shape below.

```
src/lib/
  api/
    core/        transport — nothing here knows about jobs or applicants
      config.ts     base URL, Origin/language headers, mock-mode switch
      client.ts     axios instance, auth header, 401 → sign out
      tokens.ts     token storage, applicant and admin tiers
      request.ts    the { rettype, retmsg, retdata } envelope
      errors.ts     one error shape for the whole app
      factories.ts  the two repeating endpoint patterns (below)
    profile.ts      core record, photo, CV, completion percentages
    reference.ts    every dropdown
    sections.ts     the CV sections, over three bundle endpoints
    jobs.ts         open postings, detail, filter data
    applications.ts applying, tracking, interested roles
    system.ts       CMS endpoints from the older reference doc — NOT in the collection

  jobs/          domain — the shape the UI renders
    types.ts       Job, JobDetail, FacetOption
    mapper.ts      posting rows → Job   ← the whole translation surface
    service.ts     listJobs / listJobsSafe / getJob / getFilterData
    filters.ts     facet tallies and matching

src/server/mock/   the bundled stand-in backend (see below)
src/app/api/applicant/[...path]/route.ts
```

## The envelope

Every response looks like this, success or failure:

```json
{ "totalrow": 0, "affectedrows": 86, "retdata": …, "rettype": 0, "retmsg": "" }
```

`rettype: 0` means success and `retdata` is the payload. **A failure can arrive
with HTTP 200** and its text in `retmsg`, so `core/request.ts` unwraps and
raises in the same place: anything non-zero becomes an `ApiError` carrying
`retmsg`. Components never see the envelope.

Two headers ride along on every call: `language` (MN) and `Origin`. Browsers
set `Origin` themselves and forbid scripts from touching it, so the client only
supplies it for server-side requests.

## Sign-up and sign-in

Applicants sign in and sign up with **Clerk** (`/sign-in`, `/sign-up`; the old
`/login` and `/register` only redirect there). Nothing in the browser logs in to
the ERP, and there is no регистр/утас login form. Their анкет lives in D1
behind the same-origin `/api/me/*` (`src/server/applicant/`).

**The identity gate.** The ERP creates an applicant from регистр, овог, нэр and
утас (`SaveHrAppUser`, Postman 01), so until all four are stored nothing
ERP-backed is offered: `/api/me` refuses every POST except `SaveHrApplicant`
(`server/applicant/identity-gate.ts`), and the UI asks for the four in place
(`components/account/identity-gate.tsx`, on /account and in the apply sheet).

**The ERP login is server-side.** The sync (`server/applicant/erp-push.ts`
`loginFor`) first calls `POST /api/applicant/auth/login` with `{ regNo, mobile }`
— not in the collection, verified live: wrong credentials are HTTP 401,
`rettype -1`, "Бүртгэгдсэн регистрийн дугаар болон утасны дугаар зөрж байна!".
Only that 401, on an account not yet linked, falls back to one `SaveHrAppUser`:
a new регистр is created and answered with `retdata.access_token`; a known one
logs in when `mobilephone` matches, else the same "…зөрж байна!".

**The phone number is the password.** `mobilephone` is the initial password,
and after a change on the ERP it is the new one — which is why the ERP
record's `mobilephone` (the contact number) is never pulled over the D1 утас
that logged in. A refusal is stored and shown (`erplinkerror`, on /account and
in the apply sheet); those credentials are not sent again until the applicant
changes регистр/утас or presses «Дахин оролдох» (`saveProfile(…, { retryLink:
true })`) — an ordinary profile save never retries.

**Changing the утас moves the password.** The server keeps the утас the ERP
last accepted (`erp.loginPhone`, never sent to the browser). When the stored
утас differs on a linked account, the sync logs in with the old pair, calls
`changeUserInfo {phonenumber, email, oldpassword, newpassword, type:
"PASSWORD"}` (Postman 03), then continues with the new pair; the next
`SaveHrApplicant` carries the new утас as `mobilephone`. A refused change
(rettype ≠ 0) is stored as the refusal with the ERP's own message.

## Two patterns carry most of the surface

**Reference dropdowns.** Around twenty endpoints take `?search=&lfr=false&ids=`
(three take `search` only) and answer with `{ key, text }` rows. `createDropdown`
turns each into one line in `reference.ts` and normalises rows to
`{ value, label, raw }` — `raw` matters for `getPositionsDropdown`, whose rows
carry `posgroupid` and `depid`.

**CV sections.** Three bundle endpoints return every list the CV needs:

| Bundle | Lists |
| --- | --- |
| `GetHrAppEducationData` | `hrappedulist` · `hrapplanglist` · `hrappquallist` · `hrappcomplist` |
| `GetHrAppExperienceData` | `hrappexplist` · `hrappprojectlist` · `hrappinternlist` |
| `GetHrAppFamilyData` | `hrappfamilylist` · `hrapprelativelist` |

`createSection` points a section at its bundle and names its list, so a screen
can read one section or take the whole bundle in a single call. `SectionManager`
on the UI side renders any of them from a field description, which is why
education, languages, computer skills, experience and family are five config
objects rather than five screens.

Three details the collection is explicit about, and this layer encodes:

1. **Deletes take their id in the query string**, and the parameter name varies:
   `?entryid=` for most, `?ENTRYID=` for education, `?entryID=` for
   `DeleteOrderApp` and `getRecruitmentOrderItem`.
2. **`SaveAppSkillComp` and `SaveAppFamily` take an array** — every row at once.
3. **`Get…?entryid=0` returns nothing.** Use the bundle for lists.

## Job postings

`getRecruitmentOrderList` returns rows keyed by `entryid`, with `posname`,
`locname`, `companyname`, `posgroupname`, `worktype`, the advert window and
`remainingdays` (negative once closed). `getRecruitmentOrderItem` answers with
an *object*: `hrrecruitmentorder[0]` plus `mainresp[]` and `mainreq[]`, each row
a `{ name }`. The same text also arrives as JSON strings in `orderreq` /
`orderres`; the parsed arrays are what `jobs/mapper.ts` reads.

`getDropDownData` returns the filter bundle in one call: `location`,
`salarylevel`, `smcompany`, `hrposgroup`, `positiontype`. The API filters on
position name, location and salary band; position group, company and work type
are refined client-side over the rows already fetched.

## The bundled mock backend

`NEXT_PUBLIC_API_URL` unset → the app talks to `src/app/api/applicant/[...path]`,
which answers on the same paths with the same envelope, backed by the in-memory
store in `src/server/mock/`. Accounts, CVs, applications and every CV section
are real writes that survive until the server restarts. `auth/login` and
`SaveHrAppUser` answer as the live ERP does (token, 401 / "…зөрж байна!"). Set the env var and the
client goes to the real origin instead; nothing else changes.

The seed data in `src/server/mock/data.ts` uses shapes copied from the
collection's example responses. The first two postings are the collection's own
example rows, kept verbatim; the rest is local demo content in the same shape.

## Conventions

- Components never import axios. If a call is missing, add it to the module it
  belongs to and export it from `index.ts`.
- Endpoint modules speak the backend's language — `entryid`, `regno`,
  `mobilephone` — and return its rows unchanged. Renaming happens in
  `lib/jobs`, never in a component.
- Public reads pass `skipAuth: true` so they work during server rendering.
- Tokens live in `localStorage`, so authenticated screens are client-rendered
  and the public job pages stay on the server. Moving to an httpOnly cookie
  would change `core/tokens.ts` and nothing else.

## Not covered

`system.ts` holds the `/api/system` CMS endpoints from the older endpoint
reference. They are **not in this collection** and unverified — treat those
shapes as provisional.

No token refresh and no logout call: the server-side sync logs in afresh for
each batch. The reference doc's `/auth/refresh-token` is not used.
