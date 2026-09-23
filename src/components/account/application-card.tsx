"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarClock,
  Hash,
  Loader2,
  MapPin,
  XCircle,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApplicationRow } from "@/lib/api/applications";
import {
  displayApplicationDate,
  erpRequestNumber,
  postingHref,
  salaryText,
  statusLabel,
  statusTone,
  syncState,
  type StatusTone,
} from "./application-format";

const TONE_PILL: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  negative: "bg-destructive/10 text-destructive",
};
const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/60",
  pending: "bg-amber-500",
  positive: "bg-emerald-500",
  negative: "bg-destructive",
};

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="bg-muted text-muted-foreground mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-sm font-medium tabular-nums">{value}</dd>
      </div>
    </div>
  );
}

/**
 * One sent application. `onWithdraw` performs the withdrawal (and its own
 * toasts / reload) and resolves true on success; the dialog stays open on
 * failure so the applicant can retry.
 */
export function ApplicationCard({
  row,
  onWithdraw,
}: {
  row: ApplicationRow;
  onWithdraw: (row: ApplicationRow) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const tone = statusTone(row.statusname);
  const salary = salaryText(row.salaryname);
  const available = displayApplicationDate(row.availabledate);
  const sent = displayApplicationDate(row.senddate);
  const place = [row.companyname, row.locname].filter(Boolean);
  const requestNumber = erpRequestNumber(row);
  const sync = syncState(row);
  const href = postingHref(row);
  const titleId = `application-${String(row.entryid)}-title`;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      if (await onWithdraw(row)) setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <article
        aria-labelledby={titleId}
        aria-busy={busy}
        className={cn(
          "border-border/70 bg-card rounded-2xl border p-4 shadow-xs transition-all sm:p-5",
          "hover:border-primary/40 hover:shadow-md focus-within:border-primary/40",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-56">
            <h3 id={titleId} className="text-base font-semibold tracking-[-0.01em] break-words">
              {href ? (
                <Link
                  href={href}
                  className="hover:text-primary focus-visible:text-primary underline-offset-4 hover:underline"
                >
                  {row.posname}
                </Link>
              ) : (
                row.posname
              )}
            </h3>
            {place.length > 0 ? (
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                {row.companyname ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" aria-hidden />
                    {row.companyname}
                  </span>
                ) : null}
                {row.locname ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    {row.locname}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                TONE_PILL[tone],
              )}
            >
              <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden />
              <span className="sr-only">Төлөв: </span>
              {statusLabel(row.statusname)}
            </span>
            {sync ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]">
                <span className={cn("size-1.5 rounded-full", TONE_DOT[sync.tone])} aria-hidden />
                <span className="sr-only">ERP: </span>
                {sync.label}
              </span>
            ) : null}
            {sync?.hint ? (
              <span className="text-muted-foreground max-w-56 text-right text-[11px]">{sync.hint}</span>
            ) : null}
          </div>
        </header>

        {row.withdrawerror ? (
          <p
            role="status"
            className="border-destructive/30 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
          >
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>Хүсэлтийг цуцалж чадсангүй: {row.withdrawerror}</span>
          </p>
        ) : null}

        <div
          className={cn(
            "mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5",
            salary.chosen
              ? "border-primary/25 bg-primary/5"
              : "border-border/70 bg-muted/40 border-dashed",
          )}
        >
          <Banknote
            className={cn("size-4 shrink-0", salary.chosen ? "text-primary" : "text-muted-foreground")}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Хүссэн цалингийн түвшин</p>
            <p
              className={cn(
                "text-sm break-words",
                salary.chosen ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {salary.text}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {available ? (
            <Detail icon={CalendarCheck} label="Ажилд орох боломжтой огноо" value={available} />
          ) : null}
          {sent ? <Detail icon={CalendarClock} label="Илгээсэн огноо" value={sent} /> : null}
          {requestNumber !== null ? (
            <Detail icon={Hash} label="Хүсэлтийн дугаар" value={`#${requestNumber}`} />
          ) : null}
        </dl>

        <div className="border-border/60 mt-4 flex justify-end border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            disabled={busy}
            aria-label={`«${row.posname}» хүсэлтийг цуцлах`}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive h-9 rounded-full px-4 text-sm"
          >
            <XCircle className="size-4" aria-hidden />
            Хүсэлт цуцлах
          </Button>
        </div>
      </article>

      <Dialog open={open} onOpenChange={(next) => (busy ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Хүсэлтээ цуцлах уу?</DialogTitle>
            <DialogDescription>
              «{row.posname}» ажлын байрны хүсэлтийг цуцлахад буцааж сэргээх боломжгүй.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Болих
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={confirm}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "Цуцалж байна…" : "Цуцлах"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
