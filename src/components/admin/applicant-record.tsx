import { Download, Eye, FileText, ShieldAlert, User } from "lucide-react";

import { Field, Section } from "@/components/admin/record-blocks";
import { Button } from "@/components/ui/button";
import { canPreview } from "@/server/applicant/cv-download";
import type { ApplicantRecord, RecordEntry, RecordGroup } from "@/server/applicant/applicant-record";

/**
 * The applicant behind the application: their анкет, their CV and their photo.
 *
 * Drawn only for an `admin` (`mayViewApplicantData`), and everything on it is
 * somebody's personal data. Two consequences shape the screen:
 *
 * - **the CV and the photo are links, not bytes on this page.** They are
 *   served by `/admin/applications/<key>/file/<kind>`, which checks the role
 *   itself — so this page can be cached by nothing, printed, or screenshotted
 *   without carrying the file, and the file's own request is logged as its own
 *   request. A PDF gets «Үзэх» as well as «Татах»; a `.doc` only downloads,
 *   because a browser will not render one anyway.
 * - **the notice at the top is not decoration.** The утас on this screen is
 *   the applicant's ERP password (`src/lib/api/README.md`), and a reader who
 *   does not know that will treat it as an ordinary phone number.
 *
 * The values arrive already formatted (`server/applicant/applicant-record.ts`):
 * dates through the desk's own `deskDate`, reference codes stripped, ids and
 * empty fields dropped. Nothing here decides what an applicant's field means.
 */

const SIZE_UNITS = ["Б", "КБ", "МБ"] as const;

/** `1.2 МБ`. Rounded to one decimal from a megabyte up, whole units below. */
function fileSize(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(size)) : size.toFixed(1).replace(/\.0$/u, "");
  return `${rounded} ${SIZE_UNITS[unit]}`;
}

const TYPE_NAMES: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

/** `Бат_CV.pdf · PDF · 412 КБ`, leaving out what the store does not know. */
const cvCaption = (cv: NonNullable<ApplicantRecord["cv"]>): string =>
  [cv.filename, TYPE_NAMES[cv.contentType], cv.byteSize > 0 ? fileSize(cv.byteSize) : ""]
    .filter(Boolean)
    .join(" · ");

function Files({ record, href }: { record: ApplicantRecord; href: (kind: string) => string }) {
  const { cv } = record;

  return (
    <Section title="CV ба зураг">
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="flex min-w-0 items-start gap-3">
          <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium">CV</p>
            {cv ? (
              <p className="mt-0.5 max-w-[46ch] text-[0.75rem] break-words text-muted-foreground">
                {cvCaption(cv)}
              </p>
            ) : (
              <p className="mt-0.5 text-[0.75rem] text-muted-foreground">Хавсаргаагүй байна.</p>
            )}
            {cv && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  {/* A download, so no `target` — the page stays where it is. */}
                  <a href={href("cv")} download>
                    <Download aria-hidden className="size-3.5" />
                    Татах
                  </a>
                </Button>
                {canPreview(cv.filename) && (
                  <Button asChild size="sm" variant="ghost">
                    <a href={`${href("cv")}?view=1`} target="_blank" rel="noreferrer">
                      <Eye aria-hidden className="size-3.5" />
                      Шинэ цонхонд үзэх
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="text-right">
            <p className="text-[0.8125rem] font-medium">Зураг</p>
            <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
              {record.hasPhoto ? "Хавсаргасан" : "Байхгүй"}
            </p>
          </div>
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted">
            {record.hasPhoto ? (
              /* The bytes are behind the role-checked route, and they are
                 `no-store`, so there is nothing for next/image to optimise. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={href("photo")}
                alt={`${record.name || "Нэр дэвшигч"} — зураг`}
                className="size-full object-cover"
              />
            ) : (
              <User aria-hidden className="size-5 text-muted-foreground" />
            )}
          </span>
        </div>
      </div>
    </Section>
  );
}

/** One row of a repeating section: a heading, its summary line, then its fields. */
function Entry({ entry }: { entry: RecordEntry }) {
  return (
    <li className="border-b border-border py-3.5 last:border-b-0">
      <p className="text-[0.8125rem] leading-snug font-medium">{entry.title}</p>
      {entry.summary && (
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{entry.summary}</p>
      )}
      {entry.fields.length > 0 && (
        <dl className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {entry.fields.map((field) => (
            <div key={field.label} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-[0.75rem] text-muted-foreground">{field.label}:</dt>
              <dd className="min-w-0 text-[0.75rem] break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function Group({ group }: { group: RecordGroup }) {
  return (
    <Section title={group.title}>
      {group.fields && (
        <dl className="mt-1">
          {group.fields.map((field) => (
            <Field key={field.label} term={field.label}>
              {field.value}
            </Field>
          ))}
        </dl>
      )}
      {group.entries && (
        <ul className="mt-1 border-b border-border">
          {group.entries.map((entry, index) => (
            <Entry key={`${entry.title}-${index}`} entry={entry} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export const RECORD_NOTICE =
  "Доорх мэдээлэл нь нэр дэвшигчийн хувийн мэдээлэл. Утасны дугаар нь тэдний ERP-д " +
  "нэвтрэх нууц үг болдог тул бусдад дамжуулахгүй байхыг анхаарна уу.";

export const RECORD_EMPTY = "Нэр дэвшигч анкетынхаа бусад хэсгийг бөглөөгүй байна.";

export function ApplicantRecordView({
  record,
  applicationKey,
}: {
  record: ApplicantRecord;
  /** The row's idempotency key — the file route's address. */
  applicationKey: string;
}) {
  const href = (kind: string) => `/admin/applications/${applicationKey}/file/${kind}`;

  return (
    <>
      <Section title="Нэр дэвшигчийн анкет">
        <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted-foreground">
          <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="max-w-[68ch]">{RECORD_NOTICE}</span>
        </p>
      </Section>

      <Files record={record} href={href} />

      {record.groups.map((group) => (
        <Group key={group.title} group={group} />
      ))}

      {record.empty && (
        <p className="mt-4 text-[0.75rem] text-muted-foreground">{RECORD_EMPTY}</p>
      )}
    </>
  );
}
