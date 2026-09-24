"use client";

import { useIdentityReady } from "@/components/account/identity-gate";
import { useSession } from "@/components/auth/session-provider";
import { ApplyForm } from "@/components/apply-form";
import { IdentityPanel, SentPanel, SignInPanel } from "@/components/apply-panels";
import { useApplyForm, useApplyOptions } from "@/components/use-apply-form";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { JobDetail } from "@/lib/jobs/types";

/**
 * Applying to a posting: the sheet shell. What it asks is in `apply-form.tsx`,
 * the state and send in `use-apply-form.ts`, the checks in `apply-submit.ts`.
 *
 * The backend answers success for a posting that does not exist and happily
 * accepts a second application to the same one, so the send reads the
 * applicant's list before and after rather than trusting the response.
 */
export const ApplyDialog = ({
  job,
  open,
  onOpenChange,
}: {
  job: JobDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { status } = useSession();
  const { blocked } = useIdentityReady();
  const options = useApplyOptions(open);
  const apply = useApplyForm(job, options.salaryLevels.options);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    // Let the sheet finish closing before its content changes back.
    if (!next) window.setTimeout(apply.reset, 250);
  };

  const body = apply.isSent ? (
    <SentPanel job={job} onClose={() => handleOpenChange(false)} />
  ) : status !== "authenticated" ? (
    <SignInPanel onClose={() => handleOpenChange(false)} />
  ) : blocked ? (
    <IdentityPanel />
  ) : (
    <ApplyForm job={job} apply={apply} options={options} />
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        aria-describedby="apply-description"
      >
        {body}
      </SheetContent>
    </Sheet>
  );
};
