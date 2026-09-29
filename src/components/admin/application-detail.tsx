import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ExternalLink, Info, Mail } from "lucide-react";

import {
  deskStatus,
  deskTime,
  reasonLabel,
  rowJob,
  rowName,
  statusLabel,
} from "@/app/admin/applications/labels";
import { StatusPill } from "@/components/admin/application-row";
import { AvatarPlaceholder } from "@/components/admin/applicant-record";
import { EMPTY, Fact, Panel, or } from "@/components/admin/record-blocks";
import type { DeskApplicationDetail, DeskSource } from "@/server/applicant/application-desk";
import { MAX_ATTEMPTS } from "@/server/applicant/erp-retry";

/**
 * One application, in full — which is still not very much, and that is the
 * design.
 *
 * Two things bring an admin here: the person (their CV, their анкет) and the
 * question "is this application in the ERP, and if not, why not". So the
 * header says who and for what and carries the CV, the wide column is the
 * анкет, and the narrow one beside it is the application and its push — with
 * the push's bookkeeping folded under «Дэлгэрэнгүй». There is no card grid
 * and no chart; a record is a record, and hairlines are what a record looks
 * like.
 *
 * **What is on this component and what is not.** What it draws itself carries
 * no регистр, no утас and no CV: it is built from `DeskApplicationDetail`,
 * which does not have them, and its tests say so. The applicant's own details
 * are slots — `avatar`, `cv` and `profile` (`applicant-record.tsx`), filled
 * only for an `admin` (`mayViewApplicantData`) — so an `editor` reading this
 * screen sees the application and the push and nothing about the person beyond
 * their name and the address HR writes to.
 *
 * One thing is never here in either case: anything the ERP said. `error` is a
 * classified code from `erp-retry.ts` rendered through `reasonLabel`; the
 * upstream `retmsg` is neither stored on these shapes nor shown, because it has
 * been seen echoing an applicant's name and register number back at the caller.
 */

export function ApplicationDetail({
  application,
  source,
  openPostings,
  retry,
  avatar,
  cv,
  profile,
}: {
  application: DeskApplicationDetail;
  source: DeskSource;
  /** Postings the ERP is still advertising; empty when it did not answer. */
  openPostings: ReadonlySet<number>;
  /** «Дахин илгээх», or nothing for an `editor`. */
  retry?: ReactNode;
  /** The applicant's photo (`ApplicantAvatar`) — `admin` only. */
  avatar?: ReactNode;
  /** The CV and its view / download controls (`ApplicantCv`) — `admin` only. */
  cv?: ReactNode;
  /**
   * The applicant's анкет — `ApplicantRecordView`, or nothing when the reader
   * is not an `admin`. Slots rather than prop shapes: this component knows the
   * application, and nothing about what a person's record looks like.
   */
  profile?: ReactNode;
}) {
  const status = deskStatus(application.push);
  const { push } = application;
  const postingKnown = source.erp.reachable && application.jobId > 0;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 lg:px-8">
      <Link
        href="/admin/applications"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Ирсэн өргөдөл
      </Link>

      {/* Who, for what, where it stands — and the CV, which is what the page
          is most often opened for. Everything below is detail. */}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-5 border-b-2 border-b-[var(--rule-strong)] pb-5">
        <div className="flex min-w-0 items-start gap-4">
          {avatar ?? <AvatarPlaceholder />}
          <div className="min-w-0">
            <h1 className="news-headline text-2xl sm:text-3xl">{rowName(application)}</h1>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">{rowJob(application)}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem]">
              <StatusPill status={status} />
              <span className="text-muted-foreground tabular-nums">
                {deskTime(application.appliedAt)}
              </span>
              <a
                href={`mailto:${application.email}`}
                className="inline-flex min-w-0 items-center gap-1 break-all underline decoration-1 underline-offset-4"
              >
                <Mail aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                {application.email}
              </a>
            </div>
            {!cv && (
              <p className="mt-2 text-[0.75rem] text-muted-foreground">
                CV: {application.hasCv ? "Хавсаргасан" : "Хавсаргаагүй"} · Зураг:{" "}
                {application.hasPhoto ? "Байгаа" : "Байхгүй"}
              </p>
            )}
          </div>
        </div>
        {cv}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* The side column first in the source: on a phone the application and
            its state are the short answer, and the анкет is the long read. */}
        <aside className="flex flex-col gap-8 lg:sticky lg:top-6 lg:order-last lg:self-start">
          <Panel title="Өргөдөл">
            <dl className="mt-1">
              <Fact term="Ажлын байр">
                {application.jobId > 0 ? (
                  <Link
                    href={`/careers/${application.jobId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-1 underline-offset-4"
                  >
                    {rowJob(application)}
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                  </Link>
                ) : (
                  rowJob(application)
                )}
              </Fact>
              {postingKnown && (
                <Fact term="Зарын төлөв">
                  {openPostings.has(application.jobId) ? "Нээлттэй" : "Хаагдсан"}
                </Fact>
              )}
              <Fact term="Компани">{or(application.company)}</Fact>
              <Fact term="Байршил">{or(application.location)}</Fact>
              <Fact term="Цалингийн түвшин">{or(application.salary)}</Fact>
              <Fact term="Ажилд орох боломжтой">{deskTime(application.availableFrom)}</Fact>
              <Fact term="ERP дэх төлөв">{or(application.erpStatus)}</Fact>
            </dl>
          </Panel>

          <Panel title="ERP-д илгээсэн байдал">
            <dl className="mt-1">
              <Fact term="Төлөв">{statusLabel(status)}</Fact>
              {push.error && <Fact term="Шалтгаан">{reasonLabel(push.error)}</Fact>}
              <Fact term="Оролдлого">
                <span className="tabular-nums">
                  {push.attempts}/{MAX_ATTEMPTS}
                </span>
              </Fact>
            </dl>

            {retry && <div className="mt-3">{retry}</div>}

            {/* What only someone chasing a failed push needs. Folded, not
                removed: it is the trail between this row and the ERP. */}
            <details className="group mt-3">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden
                  className="size-3.5 transition-transform group-open:rotate-90"
                />
                Дэлгэрэнгүй
              </summary>
              <dl className="mt-1">
                <Fact term="Энэ сайтад хадгалсан">{deskTime(push.submittedAt)}</Fact>
                <Fact term="Сүүлд оролдсон">{deskTime(push.lastAttemptAt)}</Fact>
                <Fact term="ERP дэх хүсэлтийн дугаар">
                  {push.erpEntryId ? (
                    <span className="tabular-nums">{push.erpEntryId}</span>
                  ) : (
                    EMPTY
                  )}
                </Fact>
                <Fact term="Мөрийн түлхүүр">
                  <span className="font-mono text-[0.75rem] break-all">{application.key}</span>
                </Fact>
                {application.log && (
                  <Fact term="Хуучин D1 бүртгэл">
                    <span className="tabular-nums">
                      {application.log.status}
                      {application.log.erpApplicationId
                        ? ` · #${application.log.erpApplicationId}`
                        : ""}{" "}
                      · {deskTime(application.log.createdAt)}
                    </span>
                  </Fact>
                )}
              </dl>
            </details>
          </Panel>
        </aside>

        <div className="min-w-0">
          {profile ?? (
            <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="max-w-[60ch]">
                Нэр дэвшигчийн анкет, регистрийн дугаар, утас болон CV-г зөвхөн админ эрхтэй
                ажилтан харна. Танд тэр эрх байхгүй байна.
              </span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
