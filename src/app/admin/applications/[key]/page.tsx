import Link from "next/link";

import { ApplicantRecordView } from "@/components/admin/applicant-record";
import { ApplicationDetail } from "@/components/admin/application-detail";
import { ApplicationSource } from "@/components/admin/application-source";
import { Button } from "@/components/ui/button";
import {
  mayRetryApplications,
  mayViewApplicantData,
  requireAdminUser,
} from "@/server/admin/guard";
import { getApplicantRecord } from "@/server/applicant/applicant-record";
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
 * Read by both roles, and the two see different amounts of it. «Дахин илгээх»
 * is `admin` only and is not drawn for an `editor` — and
 * `retryApplicationAction` refuses them as well, because the button is not the
 * gate. The applicant's own анкет and CV are `admin` only for the reason in
 * `mayViewApplicantData`, and the same way: an `editor` does not have the read
 * done at all rather than having it hidden with CSS, and the file route behind
 * the CV checks the role itself.
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

/**
 * The анкет, or null when it cannot be read.
 *
 * A record that fails is not a reason to withhold the application: the push
 * state is what the desk is for, and it is already on the screen above.
 */
async function loadRecord(email: string) {
  try {
    return await getApplicantRecord(email);
  } catch (error) {
    console.error(
      "[admin/applications] applicant record read failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
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

  // Read only when this reader may see it, and only after the application was
  // found: the анкет is a second query, and a page that is about to 404 has no
  // business opening somebody's record to draw it.
  const record = mayViewApplicantData(user) ? await loadRecord(application.email) : null;

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
        profile={
          record ? (
            <ApplicantRecordView record={record} applicationKey={application.key} />
          ) : undefined
        }
      />
      <div className="mx-auto w-full max-w-3xl px-5 pb-10 lg:px-8">
        <ApplicationSource source={source.source} />
      </div>
    </>
  );
}
