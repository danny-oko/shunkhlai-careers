"use client";

import * as React from "react";

import { applications } from "@/lib/api";

/**
 * How many applications the applicant has sent ("Хүсэлтийн тоо").
 *
 * The record has no such key — the old site's header counts the rows of
 * `getRecruitmenRequestList`, so this does too. `null` until it answers, or
 * if it fails; the header then shows a dash rather than a wrong zero.
 */
export const useRequestCount = (): number | null => {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    applications
      .listMine()
      .then((rows) => {
        if (!cancelled) setCount(rows.length);
      })
      .catch((countError) => {
        console.error("[account] request count failed", countError);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return count;
};
