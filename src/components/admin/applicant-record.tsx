import { Download, Eye, FileText, ShieldAlert, User } from "lucide-react";

import { Fact, Section } from "@/components/admin/record-blocks";
import { Button } from "@/components/ui/button";
import { canPreview } from "@/server/applicant/cv-download";
import type { ApplicantRecord, RecordEntry, RecordGroup } from "@/server/applicant/applicant-record";

/**
 * The applicant behind the application: their анкет, their CV and their photo.
 *
 * Drawn only for an `admin` (`mayViewApplicantData`), and everything on it is
 * somebody's personal data. Two consequences shape the screen:
 *
 * - **the CV and the photo are links, not bytes on this page.** They sit in
 *   the page header (`ApplicantCv`, `ApplicantAvatar`), and they are
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

/** The file route for this application — role-checked, see the header. */
const fileHref = (applicationKey: string, kind: "cv" | "photo") =>
  `/admin/applications/${applicationKey}/file/${kind}`;

/**
 * The applicant's photo, for the page header. A link to the role-checked
 * route, never the bytes: the page carries no base64.
 */
export function ApplicantAvatar({
  record,
  applicationKey,
}: {
  record: ApplicantRecord;
  applicationKey: string;
}) {
  if (!record.hasPhoto) return <AvatarPlaceholder />;
  return (
    <span className="flex size-16 shrink-0 overflow-hidden border border-border bg-muted">
      {/* The bytes are behind the role-checked route, and they are
          `no-store`, so there is nothing for next/image to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fileHref(applicationKey, "photo")}
        alt={`${record.name || "Нэр дэвшигч"} — зураг`}
        className="size-full object-cover"
      />
    </span>
  );
}

/** The empty frame the header shows without a photo, or to an `editor`. */
export function AvatarPlaceholder() {
  return (
    <span className="flex size-16 shrink-0 items-center justify-center border border-border bg-muted">
      <User aria-hidden className="size-6 text-muted-foreground" />
    </span>
  );
}

/**
 * The CV, for the page header: what it is and the two things to do with it.
 * It is what an admin opens this page for most often, so it is the first
 * control on it rather than a section halfway down.
 */
export function ApplicantCv({
  record,
  applicationKey,
}: {
  record: ApplicantRecord;
  applicationKey: string;
}) {
  const { cv } = record;
  const href = fileHref(applicationKey, "cv");

  return (
    <div className="flex min-w-0 items-start gap-2.5 border border-border px-3.5 py-3 sm:max-w-[22rem]">
      <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium">CV</p>
        <p className="mt-0.5 text-[0.75rem] break-words text-muted-foreground">
          {cv ? cvCaption(cv) : "Хавсаргаагүй байна."}
        </p>
        {cv && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {canPreview(cv.filename) && (
              <Button asChild size="sm">
                <a href={`${href}?view=1`} target="_blank" rel="noreferrer">
                  <Eye aria-hidden className="size-3.5" />
                  Үзэх
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              {/* A download, so no `target` — the page stays where it is. */}
              <a href={href} download>
                <Download aria-hidden className="size-3.5" />
                Татах
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
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

function Group({ group, id }: { group: RecordGroup; id: string }) {
  return (
    <Section title={group.title} id={id}>
      {group.fields && (
        <dl className="mt-1 grid gap-x-8 sm:grid-cols-2">
          {group.fields.map((field) => (
            <Fact key={field.label} term={field.label}>
              {field.value}
            </Fact>
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

const groupId = (index: number) => `anket-${index + 1}`;

/**
 * The анкет itself: the notice, an index of its sections, then the sections.
 * The CV and the photo are not here — they are in the page header
 * (`ApplicantCv`, `ApplicantAvatar`).
 */
export function ApplicantRecordView({ record }: { record: ApplicantRecord }) {
  return (
    <div>
      <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted-foreground">
        <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span className="max-w-[68ch]">{RECORD_NOTICE}</span>
      </p>

      {/* A long анкет is a long scroll; this says what is in it and gets to
          any part in one click. Not drawn for one section — nothing to jump. */}
      {record.groups.length > 1 && (
        <nav aria-label="Анкетын хэсгүүд" className="mt-4 flex flex-wrap gap-1.5">
          {record.groups.map((group, index) => (
            <a
              key={group.title}
              href={`#${groupId(index)}`}
              className="inline-flex h-8 items-center border border-border px-3 text-[0.8125rem] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {group.title}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-8">
        {record.groups.map((group, index) => (
          <Group key={group.title} group={group} id={groupId(index)} />
        ))}
      </div>

      {record.empty && (
        <p className="mt-4 text-[0.75rem] text-muted-foreground">{RECORD_EMPTY}</p>
      )}
    </div>
  );
}
