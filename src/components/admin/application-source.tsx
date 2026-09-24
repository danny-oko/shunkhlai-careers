import { Cloud, CloudOff, Database } from "lucide-react";

import {
  SOURCE_SCOPE,
  SOURCE_TITLE,
  erpReachLabel,
} from "@/app/admin/applications/labels";
import type { DeskSource } from "@/server/applicant/application-desk";
import { cn } from "@/lib/utils";

/**
 * Where the rows on this screen came from, said before they are shown.
 *
 * This is not chrome and it is not a toast — it is the first thing the page
 * has to be honest about, so it sits between the heading and the list and
 * stays there. Two facts, both always true:
 *
 * 1. **The rows are this site's mirror.** The ERP is the system of record, but
 *    every endpoint of it that carries an application answers for one
 *    applicant, addressed by that applicant's own token; there is no
 *    cross-applicant listing to read. So the list can only be what passed
 *    through this site — which is a real gap, and `SOURCE_SCOPE` states it
 *    rather than letting the count on screen imply completeness.
 * 2. **Whether the ERP answered this render.** One public posting read, no
 *    applicant's credentials spent. When it fails, the list is unaffected and
 *    this line is the only thing that changes — which is exactly what a
 *    fallback should look like.
 *
 * The strip only turns destructive for a real failure. A deployment with no
 * `NEXT_PUBLIC_API_URL` is in mock mode on purpose, and painting that red
 * every day is how a warning stops being read.
 */
export function ApplicationSource({ source }: { source: DeskSource }) {
  const { erp } = source;
  const failed = !erp.reachable && erp.reason !== "erp_not_configured";
  const ErpIcon = erp.reachable ? Cloud : CloudOff;

  return (
    <div
      role="status"
      className={cn(
        "mt-4 border px-4 py-3",
        failed ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/40",
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
        <Database aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{SOURCE_TITLE}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <ErpIcon aria-hidden className="size-3.5 shrink-0" />
          {erpReachLabel(erp)}
        </span>
      </p>

      <p className="mt-1.5 max-w-[68ch] text-[0.75rem] leading-relaxed text-muted-foreground">
        {SOURCE_SCOPE}
      </p>
    </div>
  );
}
