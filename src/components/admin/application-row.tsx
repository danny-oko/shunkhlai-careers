import Link from "next/link";

import {
  type DeskStatus,
  type DeskTone,
  deskDate,
  deskStatus,
  rowJob,
  rowName,
  statusLabel,
  statusTone,
} from "@/app/admin/applications/labels";
import type { DeskApplication } from "@/server/applicant/application-desk";
import { cn } from "@/lib/utils";

/**
 * One application on the desk — and the one visual idea this screen has.
 *
 * The rows are a ledger, not cards: an application is a line in a register
 * that somebody reads top to bottom looking for the one that went wrong, and
 * nine identical rounded panels with a shadow each would give every row the
 * same weight. What carries the state instead is a 3px bar on the leading
 * edge, which is the device `admin-nav.tsx` already uses in this shell to mean
 * "the state of this row" — so the desk borrows the vocabulary rather than
 * inventing a second one.
 *
 * Colour is spent in one place. `sent` is the ordinary outcome and is drawn in
 * ink, not green: a list where nine rows in ten are a success colour is a list
 * where the tenth disappears. Only «Анхаарал шаардлагатай» gets the
 * destructive tone, and only the in-flight states get the accent.
 */

/**
 * The leading edge — drawn only for a row that is not finished.
 *
 * A bar on every row is a divider, not a signal: the eye stops reading it
 * within three rows. A settled application gets no mark at all, so the three
 * unfinished ones in a screen of thirty are the only thing with an edge.
 */
const EDGE: Readonly<Record<DeskTone, string>> = {
  positive: "before:bg-transparent",
  pending: "before:bg-[var(--paper-accent)]",
  negative: "before:bg-destructive",
  neutral: "before:bg-transparent",
};

const PILL: Readonly<Record<DeskTone, string>> = {
  positive: "border-border text-muted-foreground",
  pending: "border-transparent bg-[var(--paper-accent)]/12 text-[var(--paper-accent)]",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border text-muted-foreground",
};

export function StatusPill({
  status,
  className,
}: {
  status: DeskStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[0.6875rem] whitespace-nowrap",
        PILL[statusTone(status)],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function ApplicationRow({ row }: { row: DeskApplication }) {
  const status = deskStatus(row.push);

  return (
    <li
      className={cn(
        "relative",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        EDGE[statusTone(status)],
      )}
    >
      {/* The whole row is the link. An application is opened, never edited in
          place, so there is no second target to compete with — and a 44px
          target that spans the row is the only version of this that works
          with a thumb. */}
      <Link
        href={`/admin/applications/${row.key}`}
        className={cn(
          "flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5 pr-1 pl-4 transition-colors",
          "hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        <span className="min-w-0 flex-1 basis-40">
          <span className="news-headline block truncate text-[1.0625rem]">{rowName(row)}</span>
          <span className="mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">
            {rowJob(row)}
          </span>
        </span>

        {/* Pill and date travel together and wrap together: below ~28rem they
            drop under the name rather than squeezing the job title to three
            characters, and then spread to both edges so the date still ends
            where every other date on the screen ends. */}
        <span className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <StatusPill status={status} />
          <time className="w-[5.5rem] shrink-0 text-right text-[0.8125rem] tabular-nums text-muted-foreground">
            {deskDate(row.appliedAt)}
          </time>
        </span>
      </Link>
    </li>
  );
}
