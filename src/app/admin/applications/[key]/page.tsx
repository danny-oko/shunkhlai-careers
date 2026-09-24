import Link from "next/link";

import { ApplicationDetail } from "@/components/admin/application-detail";
import { ApplicationSource } from "@/components/admin/application-source";
import { Button } from "@/components/ui/button";
import { mayRetryApplications, requireAdminUser } from "@/server/admin/guard";
import { deskSource, getApplication } from "@/server/applicant/application-desk";
import { deskStatus } from "../labels";
import { RetryButton } from "./retry-button";

/**
 * One application.
 *
 * Addressed by the row's idempotency key rather than by email and entry id:
 * a URL is copied into chat, a bookmark and an access log, and an applicant's
 * email address does not need to be in any of them. The key is already on the
 * row (`erp-retry.ts`) and the account behind it is resolved server-side.
 *
 * Read by both roles. «Дахин илгээх» is `admin` only and is not drawn for an
 * `editor` — and `retryApplicationAction` refuses them as well, because the
 * button is not the gate.
 *
 * Dynamic for the same reason as the list.
 */
export const dynamic = "force-dynamic";

function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 lg:px-8">
      <h1 className="news-headline text-2xl">Өргөдөл олдсонгүй</h1>
      <p className="mt-2 max-w-[52ch] text-[0.8125rem] text-muted-foreground">
        Энэ хаягаар өргөдөл байхгүй байна. Нэр дэвшигч хүсэлтээ цуцалсан, эсвэл холбоос
        хуучирсан байж болно.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-5">
        <Link href="/admin/applications">Ирсэн өргөдөл</Link>
      </Button>
    </main>
  );
}

export default async function AdminApplicationPage({
  params,
}: PageProps<"/admin/applications/[key]">) {
  // The identity, not only the permission: the role decides whether the retry
  // control is drawn at all.
  const user = await requireAdminUser();
  const { key } = await params;

  let application: Awaited<ReturnType<typeof getApplication>> = null;
  let source: Awaited<ReturnType<typeof deskSource>> | null = null;
  try {
    [application, source] = await Promise.all([getApplication(key), deskSource()]);
  } catch (error) {
    console.error(
      "[admin/applications] detail read failed:",
      error instanceof Error ? error.message : error,
    );
    return <NotFound />;
  }

  if (!application || !source) return <NotFound />;

  const status = deskStatus(application.push);
  // Offered only where it does something: a `sent` row has nothing to resend,
  // and a row already queued would only have its attempt counter reset.
  const retryable = status === "attention" || status === "retrying" || status === "unknown";

  return (
    <>
      <ApplicationDetail
        application={application}
        source={source.source}
        openPostings={source.openPostings}
        retry={
          retryable && mayRetryApplications(user) ? (
            <RetryButton applicationKey={application.key} />
          ) : undefined
        }
      />
      <div className="mx-auto w-full max-w-3xl px-5 pb-10 lg:px-8">
        <ApplicationSource source={source.source} />
      </div>
    </>
  );
}
