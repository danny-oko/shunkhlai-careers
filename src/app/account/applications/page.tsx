"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/field";
import { applications, toApiError } from "@/lib/api";
import type { ApplicationRow } from "@/lib/api/applications";
import { toSlug } from "@/lib/jobs/mapper";

/**
 * The posting's title, linked to the advert the request was sent to.
 *
 * The href carries the same `<id>-<title>` slug the job list links to, and
 * `/careers/[id]` reads the id back out of it. A row that arrives without a
 * posting id stays plain text rather than becoming a dead link.
 */
function JobTitle({ row }: { row: ApplicationRow }) {
  if (!row.recruitmentorderid) {
    return <p className="font-medium">{row.posname}</p>;
  }

  return (
    <Link
      href={`/careers/${toSlug(row.recruitmentorderid, row.posname)}`}
      className="group inline-flex items-center gap-1.5 font-medium"
    >
      {row.posname}
      <ArrowUpRight className="text-muted-foreground size-4 shrink-0 opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}

/** Everything the applicant has sent, with the stage each one has reached. */
export default function ApplicationsPage() {
  const [error, setError] = React.useState<string | null>(null);

  const [token, setToken] = React.useState(0);
  const [loaded, setLoaded] = React.useState<{ token: number; rows: ApplicationRow[] } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    applications.listMine()
      .then((rows) => {
        if (cancelled) return;
        setLoaded({ token, rows });
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setLoaded({ token, rows: [] });
        setError(toApiError(loadError).message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const rows = loaded?.rows ?? [];
  const isLoading = loaded?.token !== token;

  /** Handlers call this after a write; effects never do. */
  const reload = React.useCallback(async () => {
    setToken((current) => current + 1);
  }, []);

  async function withdraw(row: ApplicationRow) {
    if (!window.confirm(`«${row.posname}» хүсэлтээ цуцлах уу?`)) return;
    try {
      await applications.withdraw(Number(row.entryid));
      toast.success("Хүсэлт цуцлагдлаа");
      await reload();
    } catch (withdrawError) {
      toast.error(toApiError(withdrawError).message);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Илгээсэн хүсэлт</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Хүсэлт бүрийн явц энд шинэчлэгдэнэ.
        </p>
      </div>

      <FormMessage message={error} />

      {isLoading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Ачаалж байна…
        </p>
      ) : rows.length === 0 ? (
        <div className="border-border/70 rounded-xl border border-dashed px-5 py-10 text-center">
          <p className="text-muted-foreground text-sm">
            Та одоогоор анкет илгээгээгүй байна.
          </p>
          <Button asChild variant="outline" className="mt-5 h-9 rounded-full px-5">
            <Link href="/careers">Нээлттэй ажлын байр үзэх</Link>
          </Button>
        </div>
      ) : (
        <ul className="border-border/70 divide-border/70 divide-y rounded-xl border">
          {rows.map((row) => (
            <li key={String(row.entryid)} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <JobTitle row={row} />
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {[row.companyname, row.locname].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge variant="secondary">{row.statusname ?? "Хүлээгдэж буй"}</Badge>
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                {row.salaryname ? <span>Цалингийн түвшин: {row.salaryname}</span> : null}
                {row.availabledate ? <span>Ажилд орох: {row.availabledate}</span> : null}
                {typeof row.senddate === "string" ? <span>Илгээсэн: {row.senddate}</span> : null}
              </div>

              <Button
                variant="ghost"
                onClick={() => withdraw(row)}
                className="text-muted-foreground hover:text-destructive h-8 rounded-full px-3 text-sm"
              >
                Хүсэлт цуцлах
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
