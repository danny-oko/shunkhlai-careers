"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { JobDetail } from "@/lib/jobs/types";

/**
 * The sheet and everything behind it — the form, its validation, the CV
 * picker, the account-identity forms — are only ever seen after a click, yet
 * they were weighed into the posting page's first load. Split off, they arrive
 * right after the page is interactive instead of before it. The dialog stays
 * mounted, so a click that lands before the chunk does simply opens the sheet
 * as soon as it is there; nothing about how it behaves has changed.
 */
const ApplyDialog = dynamic(
  () => import("@/components/apply-dialog").then((module) => module.ApplyDialog),
  { ssr: false },
);

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
