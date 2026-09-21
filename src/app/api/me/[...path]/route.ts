import { NextResponse, after } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import {
  AccountConflictError,
  type ClerkIdentity,
  loadAccount,
  saveAccount,
} from "@/server/applicant/account-store";
import {
  UNAUTHORIZED_MESSAGE,
  UPLOAD_ENDPOINTS,
  envelopeFail,
  handleApplicantRequest,
} from "@/server/applicant/handlers";
import { referenceDeps } from "@/server/applicant/reference";
import { readJson, readUpload } from "@/server/applicant/request-body";
import {
  hasDuePushes,
  pendingErp,
  pushSubmitted,
  retryDue,
  withdrawSubmitted,
} from "@/server/applicant/erp-sync";
import type { ApplicationErp } from "@/server/applicant/erp-push";
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
 * Applications are also pushed to the live ERP, best-effort and never on the
 * request path: saved in D1 as `erp.status: "pending"`, pushed in `after()`,
 * retried in `after()` on later `get` calls, and withdrawn there on
 * `DeleteOrderApp` (see `src/server/applicant/erp-sync.ts`). The extra `erp`
 * field on application rows is ignored by the UI.
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

  const isUpload = method === "POST" && UPLOAD_ENDPOINTS.has(endpoint);
  if (isUpload && Number(request.headers.get("content-length")) > MAX_UPLOAD_REQUEST_BYTES) {
    return envelope(FILE_TOO_LARGE_MESSAGE, 413);
  }
  const upload = isUpload ? await readUpload(request) : null;
  if (upload && Buffer.byteLength(upload.data, "base64") > MAX_CV_BYTES) {
    return envelope(FILE_TOO_LARGE_MESSAGE, 413);
  }
  const body = method === "POST" && !isUpload ? await readJson(request) : null;

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
      withFiles: method === "GET" && endpoint === "get",
    });

    // Withdrawing: note the ERP copy's id before the row is removed.
    const withdrawn =
      method === "POST" && endpoint === "DeleteOrderApp"
        ? account.doc.applications.find(
            (row) =>
              Number(row.entryid) ===
              Number(
                url.searchParams.get("entryid") ??
                  url.searchParams.get("ENTRYID") ??
                  url.searchParams.get("entryID"),
              ),
          )
        : undefined;
    const withdrawnErpId = (withdrawn?.erp as ApplicationErp | undefined)?.erpEntryId;

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

    // A new application is saved as pending; the ERP push runs after the reply.
    const submitted =
      method === "POST" && endpoint === "SaveHrRecruitmentOrderApp" && result.mutated
        ? (result.envelope.retdata as Record<string, unknown>)
        : null;
    if (submitted) {
      submitted.sourcetype = (body as { sourcetype?: unknown } | null)?.sourcetype ?? "WEB";
      submitted.erp = pendingErp();
    }

    if (result.mutated) {
      const file = FILE_ENDPOINTS[endpoint];
      await saveAccount(account, identity!, nextEntryId, file ? { [file]: true } : {});
    }

    if (submitted) {
      const entryid = Number(submitted.entryid);
      later(() => pushSubmitted(identity!, entryid));
    } else if (method === "GET" && endpoint === "get" && hasDuePushes(account.doc)) {
      later(() => retryDue(identity!));
    } else if (result.mutated && withdrawnErpId) {
      const doc = account.doc;
      later(() => withdrawSubmitted(doc, withdrawnErpId));
    }
    return NextResponse.json(result.envelope, { status: result.status });
  }
}

export function GET(request: Request, ctx: Ctx) {
  return handle(request, ctx, "GET");
}

export function POST(request: Request, ctx: Ctx) {
  return handle(request, ctx, "POST");
}
