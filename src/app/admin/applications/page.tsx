import { AlertTriangle, Hash, Mail, RefreshCw } from "lucide-react";
import { cn } from "cn";

import { requireAdmin } from "@/server/admin/guard";
import { MAX_ATTEMPTS, listStuckApplications } from "@/server/applicant/stuck";
import { RetryButton } from "./retry-button";
import { SweepButton } from "./sweep-button";
import { deskTime, reasonLabel, stuckVerdict } from "./stuck-labels";

/**
 * The stuck-application desk.
 *
 * Every application on this page is already saved — the applicant was told the
 * truth when they submitted it. What is missing is the copy in the ERP, and
 * this is where that stops being invisible.
 *
 * Dynamic, never cached: a cached list of stuck work is worse than no list,
 * because it shows rows that have since gone through and hides ones that have
 * not.
 */
export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage() {
  // The layout already ran this. Repeated because a page is cheap to move and
  // a page that relies on its parent stops being safe the moment someone does.
  await requireAdmin();

  const rows = await listStuckApplications();

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">ERP-д хүрээгүй хүсэлтүүд</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Эдгээр хүсэлт манай санд хадгалагдсан боловч ERP систем рүү хараахан очоогүй байна.
            Өргөдөл гаргагчид «илгээгдэж байна» гэж харагдана.
          </p>
        </div>
        <SweepButton />
      </header>

      {rows.length === 0 ? (
        <p className="border-border/70 text-muted-foreground mt-8 rounded-2xl border border-dashed px-5 py-12 text-center text-sm">
          Гацсан хүсэлт алга. Бүх хүсэлт ERP-д хүрсэн байна.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((row) => {
            const verdict = stuckVerdict(row);
            return (
              <li
                key={`${row.email}:${row.entryid}`}
                className="border-border/70 bg-card rounded-2xl border p-4 shadow-xs sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <h2 className="text-base font-semibold break-words">
                      {row.posname || `Ажлын байр #${row.recruitmentorderid}`}
                    </h2>
                    <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5 shrink-0" aria-hidden />
                        {row.email}
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Hash className="size-3.5 shrink-0" aria-hidden />
                        {row.entryid}
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <RefreshCw className="size-3.5 shrink-0" aria-hidden />
                        {row.attempts}/{MAX_ATTEMPTS} оролдлого
                      </span>
                    </p>
                  </div>
                  <RetryButton email={row.email} entryid={row.entryid} />
                </div>

                <p
                  className={cn(
                    "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
                    verdict.tone === "negative"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-border/70 bg-muted/40 text-muted-foreground",
                  )}
                >
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span>
                    <strong className="font-medium">{verdict.label}.</strong> {reasonLabel(row.error)}.
                  </span>
                </p>

                <dl className="text-muted-foreground mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs min-[420px]:grid-cols-2 sm:grid-cols-3">
                  <div className="flex gap-2">
                    <dt>Илгээсэн:</dt>
                    <dd className="tabular-nums">{deskTime(row.submittedAt)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Сүүлд оролдсон:</dt>
                    <dd className="tabular-nums">{deskTime(row.lastAttemptAt)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Түлхүүр:</dt>
                    <dd className="font-mono">{row.key.slice(0, 12)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
