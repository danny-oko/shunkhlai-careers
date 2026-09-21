"use client";

import { Loader2 } from "lucide-react";

import type { DropdownOption } from "@/lib/api";
import type { useApplyForm, useApplyOptions } from "@/components/use-apply-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    onChange={(event) => onChange(event.target.value)}
  >
    <option value="">{source.isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
    {source.options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </Select>
);

const salaryHint = (job: JobDetail) =>
  job.salaryLevel ? `Зарласан түвшин: ${job.salaryLevel}` : undefined;

const SubmitButton = ({ isSending }: { isSending: boolean }) => (
  <Button type="submit" disabled={isSending} className="h-10 w-full rounded-full text-[0.9375rem]">
    {isSending ? <Loader2 className="animate-spin" /> : null}
    Анкет илгээх
  </Button>
);

/**
 * `SaveHrRecruitmentOrderApp` attaches the applicant's saved anketa
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
      <Field label="Хүссэн цалингийн түвшин" htmlFor="salrequest" hint={salaryHint(job)}>
        <LoadedSelect
          id="salrequest"
          value={apply.form.salrequest}
          source={options.salaryLevels}
          onChange={apply.setField("salrequest")}
        />
      </Field>

      <Field label="Ажилд орох боломжтой огноо" htmlFor="poshiredate" required>
        <Input
          id="poshiredate"
          type="date"
          value={apply.form.poshiredate}
          onChange={(event) => apply.setField("poshiredate")(event.target.value)}
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
        Илгээснээр таны хадгалсан анкет энэ ажлын байранд хавсрагдана.
      </p>
    </SheetFooter>
  </form>
);
