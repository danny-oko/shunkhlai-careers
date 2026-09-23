import { NextResponse, after } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import {
  AccountConflictError,
  type ClerkIdentity,
  loadAccount,
  readCv,
  saveAccount,
} from "@/server/applicant/account-store";
import { CV_MISSING_MESSAGE, cvResponse } from "@/server/applicant/cv-download";
import {
  UNAUTHORIZED_MESSAGE,
  UPLOAD_ENDPOINTS,
  envelopeFail,
  handleApplicantRequest,
} from "@/server/applicant/handlers";
import { identityGate } from "@/server/applicant/identity-gate";
import { referenceDeps } from "@/server/applicant/reference";
import { readJson, readUpload } from "@/server/applicant/request-body";
import { uploadProblem } from "@/server/applicant/upload-check";
import {
  type InlinePull,
  markScheduled,
  pendingErp,
  pullInline,
  syncDue,
  syncTask,
  wantsBackgroundPull,
  wantsInlinePull,
} from "@/server/applicant/erp-sync";
import { hasErp } from "@/server/applicant/erp";
import { recordLocalChange, sectionByRemove, syncScheduled } from "@/server/applicant/erp-model";
import { MAX_CV_BYTES } from "@/lib/apply-schema";

/**
 * The signed-in applicant's own data, on the ERP's endpoint names
 * (`/api/me/get`, `/api/me/SaveHrApplicant`, …) and in its
 * `{ rettype, retmsg, retdata }` envelope, so the account UI is unchanged.
 *
 * Identity is Clerk; storage is D1, one document per lowercased primary email
 * (see `src/server/applicant/account-store.ts`). The endpoint logic is shared
 * with the dev mock (`src/server/applicant/handlers.ts`). Always same-origin —
 * `NEXT_PUBLIC_API_URL` only decides where labels and postings are looked up.
 *
 * Two-way sync with the live ERP (see `src/server/applicant/erp-sync.ts`),
 * never blocking a save: every mutation is recorded as local work (pending
 * rows, queued deletes, dirty profile/files) and written through in `after()`.
 * `get` pulls the ERP анкет — inline and time-boxed the first time, in
 * `after()` when stale — and retries due work. The `erp` markers on rows are
 * ignored by the UI. Without `NEXT_PUBLIC_API_URL` none of this runs.
 *
 * One path is not an ERP endpoint: `GET /api/me/cv` downloads the stored CV.
 * `get` carries only its `filename` (the ERP's `get` also has the whole file
 * as base64 `filedata` — too heavy for every session load).
 */

export const dynamic = "force-dynamic";

// The browser already refuses files over 5 MB (apply-schema); this is the
// server-side backstop for direct POSTs, so the fallback copy stays generic.
const MAX_UPLOAD_REQUEST_BYTES = MAX_CV_BYTES + 64 * 1024; // multipart overhead
const FILE_TOO_LARGE_MESSAGE = "Алдаа гарлаа. Дахин оролдоно уу.";

type Ctx = RouteContext<"/api/me/[...path]">;

const FILE_ENDPOINTS: Record<string, "cv" | "picture"> = {
  SaveAppCV: "cv",
  deleteAppCV: "cv",
  SaveAppPicture: "picture",
};

/**
 * Runs ERP work after the response. Never lets scheduling fail the request:
 * outside a request scope (tests) it is dropped — pending rows are picked up
 * by the retry on a later `get`.
 */
function later(task: () => Promise<void>) {
  try {
    after(task);
  } catch (error) {
    console.error("[erp-push]", "after_unavailable", "-", String(error));
  }
}

function envelope(retmsg: string, status: number) {
  return NextResponse.json(envelopeFail(retmsg), { status });
}

async function identify(): Promise<ClerkIdentity | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "";
  if (!user || !email) return null;
  return {
    clerkUserId: userId,
    email,
    firstname: user.firstName ?? "",
    lastname: user.lastName ?? "",
  };
}

async function handle(request: Request, ctx: Ctx, method: "GET" | "POST") {
  const identity = await identify();
  if (!identity) return envelope(UNAUTHORIZED_MESSAGE, 401);

  const { path } = await ctx.params;
  const endpoint = path.join("/");
  const url = new URL(request.url);

  if (method === "GET" && endpoint === "cv") {
    try {
      const cv = await readCv(identity.email);
      return cv?.data ? cvResponse(cv) : envelope(CV_MISSING_MESSAGE, 404);
    } catch (error) {
      console.error("[api/me] GET cv failed", error);
      return envelope("Алдаа гарлаа. Дахин оролдоно уу.", 500);
    }
  }

  const isUpload = method === "POST" && UPLOAD_ENDPOINTS.has(endpoint);
  if (isUpload && Number(request.headers.get("content-length")) > MAX_UPLOAD_REQUEST_BYTES) {
    return envelope(FILE_TOO_LARGE_MESSAGE, 413);
  }
  const upload = isUpload ? await readUpload(request) : null;
  if (upload && Buffer.byteLength(upload.data, "base64") > MAX_CV_BYTES) {
    return envelope(FILE_TOO_LARGE_MESSAGE, 413);
  }
  // Wrong kind of file: refused before anything is stored or queued for the ERP.
  const uploadRefusal = upload ? uploadProblem(endpoint, upload) : null;
  if (uploadRefusal) return envelope(uploadRefusal, 415);
  const body = method === "POST" && !isUpload ? await readJson(request) : null;

  // First visit with the ERP configured: bring the ERP анкет in before
  // answering (bounded; past the budget it finishes in the background).
  let inline: InlinePull | null = null;
  if (method === "GET" && endpoint === "get" && hasErp()) {
    try {
      const pre = await loadAccount(identity);
      if (wantsInlinePull(pre.doc)) inline = await pullInline(identity, pre.doc);
    } catch (error) {
      console.error("[erp-sync]", "inline_pull_failed", "-", String(error));
    }
    if (inline && "pending" in inline) {
      const pending = inline.pending;
      later(async () => {
        await pending;
      });
    }
  }

  try {
    // A save that loses the optimistic-lock race re-runs against the fresh row.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        if (!(error instanceof AccountConflictError) || attempt >= 2) throw error;
      }
    }
  } catch (error) {
    console.error(`[api/me] ${method} ${endpoint} failed`, error);
    return envelope("Алдаа гарлаа. Дахин оролдоно уу.", 500);
  }

  async function run() {
    const account = await loadAccount(identity!, {
      withPicture: method === "GET" && endpoint === "get",
    });

    // No write before регистр, овог, нэр, утас are stored (see identity-gate.ts).
    const refusal = identityGate(endpoint, method, account.doc, body);
    if (refusal) return envelope(refusal, 409);

    // A delete: note the row before it goes, to queue its ERP delete.
    const removedList =
      endpoint === "DeleteOrderApp"
        ? account.doc.applications
        : sectionByRemove(endpoint)
          ? account.doc[sectionByRemove(endpoint)!.key]
          : null;
    const removedId = Number(
      url.searchParams.get("entryid") ??
        url.searchParams.get("ENTRYID") ??
        url.searchParams.get("entryID"),
    );
    const removed =
      method === "POST" ? removedList?.find((row) => Number(row.entryid) === removedId) : undefined;

    let nextEntryId = account.nextEntryId;
    const result = await handleApplicantRequest(
      { endpoint, method, query: url.searchParams, body, upload },
      account.doc,
      {
        ...referenceDeps(),
        nextEntryId: () => {
          nextEntryId += 1;
          return nextEntryId;
        },
      },
    );
    if (!result) return envelope(`Тодорхойгүй хүсэлт: ${endpoint}`, 404);
    // The CV's bytes are served by GET /api/me/cv, not on every session load.
    if (method === "GET" && endpoint === "get") {
      delete (result.envelope.retdata as Record<string, unknown>).filedata;
    }

    // A new application is saved as pending; the ERP push runs after the reply.
    const submitted =
      method === "POST" && endpoint === "SaveHrRecruitmentOrderApp" && result.mutated
        ? (result.envelope.retdata as Record<string, unknown>)
        : null;
    if (submitted) {
      submitted.sourcetype = (body as { sourcetype?: unknown } | null)?.sourcetype ?? "WEB";
      // The reply below is sent from the row that `saveAccount` commits a few
      // lines on — the ERP has not been called yet and may not be for minutes.
      // So the confirmation the applicant sees is the durable write, and this
      // marker is what turns into the honest "syncing" on their card.
      submitted.erp = pendingErp(identity!.email, submitted.recruitmentorderid);
    }

    // Local work for the ERP; one scheduled sync per account at a time.
    let schedule = false;
    if (result.mutated) {
      const recorded =
        hasErp() && recordLocalChange(account.doc, endpoint, result.envelope.retdata, removed);
      if ((recorded || submitted) && !syncScheduled(account.doc)) {
        markScheduled(account.doc);
        schedule = true;
      }
      const file = FILE_ENDPOINTS[endpoint];
      await saveAccount(account, identity!, nextEntryId, file ? { [file]: true } : {});
    }

    if (schedule) {
      later(() => syncTask(identity!, { mode: "mutation" }));
    } else if (method === "GET" && endpoint === "get") {
      scheduleVisitSync(account.doc);
    }
    return NextResponse.json(result.envelope, { status: result.status });
  }

  /** On a visit: retry due work and refresh a stale pull, in one background task. */
  function scheduleVisitSync(doc: Parameters<typeof syncDue>[0]) {
    if (inline && "pending" in inline) return; // the first pull is still running
    if (inline && "ok" in inline && !inline.ok) return; // login just failed; back off
    const token = inline && "ok" in inline && inline.ok ? inline.token : undefined;
    const pull = !token && wantsBackgroundPull(doc);
    if (pull || syncDue(doc)) {
      later(() => syncTask(identity!, { mode: "retry", pull, token }));
    }
  }
}

export function GET(request: Request, ctx: Ctx) {
  return handle(request, ctx, "GET");
}

export function POST(request: Request, ctx: Ctx) {
  return handle(request, ctx, "POST");
}
