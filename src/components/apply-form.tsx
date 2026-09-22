"use client";

import Link from "next/link";
import { FileWarning, Loader2 } from "lucide-react";

import type { DropdownOption } from "@/lib/api";
import { LinkErrorNotice } from "@/components/account/identity-gate";
import { useCv } from "@/components/account/profile-files";
import { CvDropzone } from "@/components/cv-dropzone";
import type { useApplyForm, useApplyOptions } from "@/components/use-apply-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { JobDetail } from "@/lib/jobs/types";

type Loaded = { options: DropdownOption[]; isLoading: boolean };

const LoadedSelect = ({
  id,
  value,
  source,
  onChange,
}: {
  id: string;
  value: string;
  source: Loaded;
  onChange: (value: string) => void;
}) => (
  <Select
    id={id}
    value={value}
    disabled={source.isLoading}
    onValueChange={onChange}
  >
    <option value="">{source.isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
    {source.options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </Select>
);

/**
 * No CV stored: say so and take one right here (the same upload as the
 * profile page). The sheet only shows this form once the identity gate is passed.
 */
const CvNotice = () => {
  const cv = useCv();
  if (cv.filename && !cv.pending) return null;
  return (
    <div className="border-border/70 bg-muted/40 space-y-3 rounded-lg border p-4">
      <div className="flex gap-3">
        <FileWarning className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground text-sm">
          CV хавсаргаагүй байна. Энд эсвэл{" "}
          <Link href="/account/profile" className="text-foreground underline underline-offset-4">
            профайлаасаа
          </Link>{" "}
          хавсаргах нь сонгон шалгаруулалтад давуу тал болно.
        </p>
      </div>
      <CvDropzone file={cv.pending} onFileChange={cv.upload} disabled={cv.locked} />
    </div>
  );
};

const salaryHint = (job: JobDetail) =>
  job.salaryLevel ? `Зарласан түвшин: ${job.salaryLevel}` : undefined;

const SubmitButton = ({ isSending }: { isSending: boolean }) => (
  <Button type="submit" disabled={isSending} className="h-10 w-full rounded-full text-[0.9375rem]">
    {isSending ? <Loader2 className="animate-spin" /> : null}
    Анкет илгээх
  </Button>
);

/**
 * `SaveHrRecruitmentOrderApp` attaches the applicant's saved anketa and CV
 * automatically, so this form only asks for what is specific to *this*
 * application: salary level (optional), earliest start date, and where they
 * heard about the role.
 */
export const ApplyForm = ({
  job,
  apply,
  options,
}: {
  job: JobDetail;
  apply: ReturnType<typeof useApplyForm>;
  options: ReturnType<typeof useApplyOptions>;
}) => (
  <form onSubmit={apply.submit} className="flex min-h-0 flex-1 flex-col" noValidate>
    <SheetHeader className="border-border/70 gap-1 border-b px-6 py-5">
      <SheetTitle className="text-lg tracking-[-0.02em]">{job.title}-д анкет илгээх</SheetTitle>
      <SheetDescription id="apply-description">
        {job.location} · {job.workType}
      </SheetDescription>
    </SheetHeader>

    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
      {/* The ERP refused регистр + утас: the application is kept here but cannot reach it until fixed. */}
      <LinkErrorNotice fixHref="/account/profile" />
      <CvNotice />

      <Field label="Хүссэн цалингийн түвшин" htmlFor="salrequest" hint={salaryHint(job)}>
        <LoadedSelect
          id="salrequest"
          value={apply.form.salrequest}
          source={options.salaryLevels}
          onChange={apply.setField("salrequest")}
        />
      </Field>

      <Field label="Ажилд орох боломжтой огноо" htmlFor="poshiredate" required>
        <DatePicker
          id="poshiredate"
          value={apply.form.poshiredate}
          onChange={apply.setField("poshiredate")}
        />
      </Field>

      <Field label="Зарыг хаанаас мэдсэн бэ?" htmlFor="recsourceid" required>
        <LoadedSelect
          id="recsourceid"
          value={apply.form.recsourceid}
          source={options.sources}
          onChange={apply.setField("recsourceid")}
        />
      </Field>

      <FormMessage message={apply.error} />
    </div>

    <SheetFooter className="border-border/70 mt-0 gap-3 border-t px-6 py-4">
      <SubmitButton isSending={apply.isSending} />
      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        Илгээснээр таны хадгалсан анкет болон CV энэ ажлын байранд хавсрагдана.
      </p>
    </SheetFooter>
  </form>
);
