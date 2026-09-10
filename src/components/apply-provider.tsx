"use client";

import * as React from "react";
import type { JobDetail } from "@/lib/jobs/types";
import { ApplyDialog } from "@/components/apply-dialog";

type ApplyContextValue = {
  job: JobDetail;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const ApplyContext = React.createContext<ApplyContextValue | null>(null);

export function useApply(): ApplyContextValue {
  const context = React.useContext(ApplyContext);
  if (!context) {
    throw new Error("useApply must be used inside an <ApplyProvider>.");
  }
  return context;
}

export function ApplyProvider({
  job,
  children,
}: {
  job: JobDetail;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const value = React.useMemo<ApplyContextValue>(
    () => ({
      job,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [job, isOpen],
  );

  return (
    <ApplyContext.Provider value={value}>
      {children}
      <ApplyDialog job={job} open={isOpen} onOpenChange={setIsOpen} />
    </ApplyContext.Provider>
  );
}
