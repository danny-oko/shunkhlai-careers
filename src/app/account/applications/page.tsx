"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApplicationCard } from "@/components/account/application-card";
import { FormMessage } from "@/components/ui/field";
import { applications, toApiError } from "@/lib/api";
import type { ApplicationRow } from "@/lib/api/applications";

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

  /** Confirmation happens in the card's dialog; resolves true when withdrawn. */
  async function withdraw(row: ApplicationRow): Promise<boolean> {
    try {
      await applications.withdraw(Number(row.entryid));
      toast.success("Хүсэлт цуцлагдлаа");
      await reload();
      return true;
    } catch (withdrawError) {
      toast.error(toApiError(withdrawError).message);
      return false;
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
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Ачаалж байна…
          </p>
          {[0, 1].map((i) => (
            <div key={i} className="border-border/70 bg-card h-40 animate-pulse rounded-2xl border" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="border-border/70 bg-muted/30 rounded-2xl border border-dashed px-5 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Та одоогоор анкет илгээгээгүй байна.
          </p>
          <Button asChild variant="outline" className="mt-5 h-9 rounded-full px-5">
            <Link href="/careers">Нээлттэй ажлын байр үзэх</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            Нийт <span className="text-foreground font-semibold">{rows.length}</span> хүсэлт
          </p>
          <ul className="space-y-3" aria-label="Илгээсэн хүсэлтүүд">
            {rows.map((row) => (
              <ApplicationCard key={String(row.entryid)} row={row} onWithdraw={withdraw} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
