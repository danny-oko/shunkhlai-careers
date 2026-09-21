import { NextResponse } from "next/server";
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

    if (result.mutated) {
      const file = FILE_ENDPOINTS[endpoint];
      await saveAccount(account, identity!, nextEntryId, file ? { [file]: true } : {});
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
