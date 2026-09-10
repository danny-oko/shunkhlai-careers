# Recruitment API layer

Everything the app knows about the recruitment backend lives in this folder.
`Recruitment_API_Endpoint_Reference.docx` documents **117 endpoints** across
three bases; they are grouped here by what they are *for* rather than by the
path they hang off.

```
src/lib/
  api/
    core/        transport — nothing here knows about jobs or applicants
      config.ts     base URL, endpoint bases, fixture-mode switch
      client.ts     axios instance, auth header, 401 → refresh → replay
      tokens.ts     applicant + admin token storage
      request.ts    apiGet / apiGetList / apiPost / apiUpload, envelope unwrapping
      errors.ts     one error shape for the whole app
      factories.ts  the two repeating endpoint patterns (below)
    auth.ts         4    login / refresh, applicant and admin
    account.ts      8    registration, OTP, password reset, credential changes
    profile.ts      6    core applicant record, photo and CV upload
    sections.ts    ~45   the fifteen CV sections
    reference.ts    20   dropdown lists
    jobs.ts         4    public postings + the filter bundle
    applications.ts 9    applying, tracking, interests, internship sign-up
    system.ts       21   CMS: company, sliders, news, video, internship pages
    index.ts        the only import path components should use

  jobs/          domain — the shape the UI actually renders
    types.ts       Job, FilterOption
    mapper.ts      RecruitmentOrderDto → Job   ← the whole translation surface
    service.ts     listJobs / listJobsSafe / getJob
    filters.ts     location + department filtering
    fixtures.ts    offline postings, written in the backend's shape
```

## Two patterns carry two thirds of the surface

**Reference dropdowns (20 endpoints).** Every one takes `?search=&lfr=false&ids=1`,
some add a single parent id (`countryid`, `divisionid`, `skillcompid`, `type`).
`createDropdown()` in `core/factories.ts` turns each into one line in
`reference.ts` and normalises the rows into `{ value, label, raw }`.

**CV sections (~45 endpoints).** Education, languages, computer skills,
qualifications, training, certificates, family, relatives, references,
experience, projects, internships, awards, abilities and interests are all the
same resource: an optional `GetHrApp…Data` bundle for the whole tab, a
single-entry `Get…` by `entryid`, a `Save…` where `entryid: 0` means insert,
and a `Delete…`. `createSection()` expresses each as four paths, so
`sections.ts` reads as a table of what exists rather than 45 near-identical
functions.

Four sections share two tab bundles: `family` + `relative` both read
`GetHrAppFamilyData`, and `award` + `ability` both read `GetHrAppSpecialityData`.

## Auth tiers

| Tier | Endpoints | How this layer handles it |
| --- | --- | --- |
| None | all reference data, job postings, registration, OTP, password reset, every `/api/system` read | `skipAuth: true` |
| Applicant bearer | the profile, CV sections, applying, interests | default |
| Admin bearer | every `/api/system` write | `audience: "admin"` |
| "Special" | the two refresh endpoints — expiring access token in the header *and* the refresh token in the body | `core/client.ts`, driven by a 401 |

A 401 triggers one refresh; requests that raced into the same 401 wait on that
single call rather than each starting their own. A failed refresh clears the
session.

## Known gaps

1. **Response shapes are not documented.** The reference gives request bodies
   and query strings only. Three places therefore guess, and each says so in a
   comment: `core/request.ts` (`data` / `result` envelope), `core/tokens.ts`
   (`readTokenPair`), `core/factories.ts` (dropdown row id/label), and
   `jobs/mapper.ts` (posting fields). Check them against one real response each
   and delete the alternatives that turn out to be wrong.

2. **Easy Apply has no endpoint.** The site's one-screen apply form does not
   match anything in the reference. The documented path is four authenticated
   calls — `account.register()` → `auth.signIn()` → `profile.uploadCv()` →
   `applications.apply()` — which means an application requires an account. Until
   that is settled, the form posts to `applications.EASY_APPLY_PATH` and treats
   an unreachable backend as a local success.

3. **The delete endpoints document no body.** `createSection().remove()` posts
   the whole entry back, which satisfies both a `{ entryid }`-only handler and
   one that wants the full row.

4. **Tokens are in `localStorage`,** so authenticated calls are client-side
   only and Server Components cannot render authenticated pages. Moving to an
   httpOnly cookie set by a route handler would change `core/tokens.ts` and
   nothing else.

5. **Not yet reached by any UI:** `sections`, `reference`, `account`, `profile`,
   `system`, and most of `applications`. They are typed and callable; the
   screens that use them (sign-up, the CV builder, "my applications", the
   internship microsite, the news/slider surfaces) do not exist yet.

## Conventions

- Components never import axios. If a call is missing, add it to the module it
  belongs to and export it from `index.ts`.
- Endpoint modules speak the backend's language — `entryid`, `regno`,
  `mobilephone` — and return its DTOs unchanged. Renaming happens in `lib/jobs`
  (and the equivalent domain folders that follow), never in a component.
- Public reads pass `skipAuth: true` so they work during server rendering.
- `NEXT_PUBLIC_API_URL` must be an **absolute** origin; the same modules run on
  the server, where a relative base has nothing to resolve against. Unset, the
  app serves `jobs/fixtures.ts` through the real mapper.
