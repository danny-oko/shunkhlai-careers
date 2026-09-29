import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";

import {
  deskStatus,
  deskTime,
  reasonLabel,
  rowJob,
  rowName,
  statusLabel,
} from "@/app/admin/applications/labels";
import { StatusPill } from "@/components/admin/application-row";
import { EMPTY, Field, Section, or } from "@/components/admin/record-blocks";
import type { DeskApplicationDetail, DeskSource } from "@/server/applicant/application-desk";
import { MAX_ATTEMPTS } from "@/server/applicant/erp-retry";

/**
 * One application, in full — which is still not very much, and that is the
 * design.
 *
 * What an admin comes here for is the answer to "is this person's application
 * in the ERP, and if not, why not". So the screen is three lists in that
 * order: the application, the person (barely), and the push. There is no card
 * grid and no chart; a record is a record, and a `<dl>` with hairlines is what
 * a record looks like.
 *
 * **What is on this component and what is not.** The three lists below carry
 * no регистр, no утас and no CV: they are built from `DeskApplicationDetail`,
 * which does not have them, and its tests say so. The applicant's own details
 * are a separate block passed in as `profile` — `ApplicantRecordView`, drawn
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
  profile,
}: {
  application: DeskApplicationDetail;
  source: DeskSource;
  /** Postings the ERP is still advertising; empty when it did not answer. */
  openPostings: ReadonlySet<number>;
  /** «Дахин илгээх», or nothing for an `editor`. */
  retry?: ReactNode;
  /**
   * The applicant's анкет, CV and photo — `ApplicantRecordView`, or nothing
   * when the reader is not an `admin`. A slot rather than a prop shape: this
   * component knows the application, and nothing about what a person's record
   * looks like.
   */
  profile?: ReactNode;
}) {
  const status = deskStatus(application.push);
  const { push } = application;
  const postingKnown = source.erp.reachable && application.jobId > 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 lg:px-8">
      <Link
        href="/admin/applications"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Ирсэн өргөдөл
      </Link>

      <div className="mt-3 border-b-2 border-b-[var(--rule-strong)] pb-4">
        <h1 className="news-headline text-2xl sm:text-3xl">{rowName(application)}</h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">{rowJob(application)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          <span className="text-[0.8125rem] text-muted-foreground tabular-nums">
            {deskTime(application.appliedAt)}
          </span>
        </div>
      </div>

      <Section title="Өргөдөл">
        <dl className="mt-1">
          <Field term="Ажлын байр">
            {application.jobId > 0 ? (
              <Link
                href={`/careers/${application.jobId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline decoration-1 underline-offset-4"
              >
                {rowJob(application)}
                <ExternalLink aria-hidden className="size-3" />
              </Link>
            ) : (
              rowJob(application)
            )}
          </Field>
          {postingKnown && (
            <Field term="Зарын төлөв">
              {openPostings.has(application.jobId) ? "Нээлттэй" : "Хаагдсан"}
            </Field>
          )}
          <Field term="Компани">{or(application.company)}</Field>
          <Field term="Байршил">{or(application.location)}</Field>
          <Field term="Цалингийн түвшин">{or(application.salary)}</Field>
          <Field term="Ажилд орох боломжтой">{deskTime(application.availableFrom)}</Field>
          <Field term="ERP дэх төлөв">{or(application.erpStatus)}</Field>
        </dl>
      </Section>

      <Section title="Нэр дэвшигч">
        <dl className="mt-1">
          <Field term="Нэр">{rowName(application)}</Field>
          <Field term="И-мэйл">
            <a
              href={`mailto:${application.email}`}
              className="underline decoration-1 underline-offset-4"
            >
              {application.email}
            </a>
          </Field>
          <Field term="CV">{application.hasCv ? "Хавсаргасан" : "Хавсаргаагүй"}</Field>
          <Field term="Зураг">{application.hasPhoto ? "Байгаа" : "Байхгүй"}</Field>
        </dl>

        {!profile && (
          <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Нэр дэвшигчийн анкет, регистрийн дугаар, утас болон CV-г зөвхөн админ эрхтэй
              ажилтан харна. Танд тэр эрх байхгүй байна.
            </span>
          </p>
        )}
      </Section>

      {profile}

      <Section title="ERP-д илгээсэн байдал">
        <dl className="mt-1">
          <Field term="Төлөв">{statusLabel(status)}</Field>
          {push.error && <Field term="Шалтгаан">{reasonLabel(push.error)}</Field>}
          <Field term="Оролдлого">
            <span className="tabular-nums">
              {push.attempts}/{MAX_ATTEMPTS}
            </span>
          </Field>
          <Field term="Энэ сайтад хадгалсан">{deskTime(push.submittedAt)}</Field>
          <Field term="Сүүлд оролдсон">{deskTime(push.lastAttemptAt)}</Field>
          <Field term="ERP дэх хүсэлтийн дугаар">
            {push.erpEntryId ? (
              <span className="tabular-nums">{push.erpEntryId}</span>
            ) : (
              EMPTY
            )}
          </Field>
          <Field term="Мөрийн түлхүүр">
            <span className="font-mono text-[0.75rem]">{application.key}</span>
          </Field>
          {application.log && (
            <Field term="Хуучин D1 бүртгэл">
              <span className="tabular-nums">
                {application.log.status}
                {application.log.erpApplicationId ? ` · #${application.log.erpApplicationId}` : ""}{" "}
                · {deskTime(application.log.createdAt)}
              </span>
            </Field>
          )}
        </dl>

        {retry && <div className="mt-4">{retry}</div>}
      </Section>
    </main>
  );
}
