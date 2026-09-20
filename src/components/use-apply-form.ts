"use client";

import * as React from "react";

import { useDropdown } from "@/components/account/use-dropdown";
import {
  EMPTY_APPLY_FORM,
  type ApplyForm,
  type SalaryOption,
  sendApplication,
  validateApplyForm,
} from "@/components/apply-submit";
import { reference, toApiError } from "@/lib/api";
import { filterData } from "@/lib/api/jobs";
import { salaryBands } from "@/lib/jobs/apply";
import type { JobDetail } from "@/lib/jobs/types";

/** The two dropdowns; loaded once the sheet opens. */
export function useApplyOptions(open: boolean) {
  const sources = useDropdown(() => reference.sources(), [], open);

  // The bands come from the API — `salrequest` is a band key, never an amount.
  const salaryLevels = useDropdown(
    async () =>
      salaryBands(await filterData()).map((band) => ({
        value: String(band.key),
        label: `${band.text}₮`,
        raw: { key: band.key, text: band.text },
      })),
    [],
    open,
  );

  return { sources, salaryLevels };
}

/** The dialog's own state: the three answers, what to say about them, and the send. */
export function useApplyForm(job: JobDetail, salaryLevels: Array<{ value: string; label: string }>) {
  const [form, setForm] = React.useState<ApplyForm>(EMPTY_APPLY_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);

  const setField = (name: keyof ApplyForm) => (value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const reset = () => {
    setError(null);
    setIsSent(false);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const options: SalaryOption[] = salaryLevels.map((o) => ({ key: Number(o.value), text: o.label }));
    const checked = validateApplyForm(form, options);
    if (!checked.ok) return setError(checked.message);

    setIsSending(true);
    try {
      const failure = await sendApplication(job, form, checked.salaryKey);
      setError(failure);
      setIsSent(failure === null);
    } catch (submitError) {
      setError(toApiError(submitError).message);
    } finally {
      setIsSending(false);
    }
  }

  return { form, setField, error, isSending, isSent, submit, reset };
}
