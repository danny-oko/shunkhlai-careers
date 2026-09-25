"use client";

import * as React from "react";

import { listMine } from "@/lib/api/applications";

type ApplicationCount = {
  /** `null` until the first read lands, or when it failed. */
  count: number | null;
  /** The applications page reports its fresh count after every load. */
  setCount: (count: number) => void;
};

const ApplicationCountContext = React.createContext<ApplicationCount>({
  count: null,
  setCount: () => {},
});

/**
 * How many applications the applicant has sent, for the badge on the
 * «Илгээсэн хүсэлт» tab. Read once when the account area mounts; the
 * applications page keeps it current after a withdraw.
 */
export function ApplicationCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listMine()
      .then((rows) => {
        if (!cancelled) setCount(rows.length);
      })
      // The badge is decoration: a failed read just leaves it off.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = React.useMemo(() => ({ count, setCount }), [count]);
  return <ApplicationCountContext value={value}>{children}</ApplicationCountContext>;
}

export function useApplicationCount() {
  return React.useContext(ApplicationCountContext);
}
