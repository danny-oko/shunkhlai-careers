"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, FileWarning, Loader2 } from "lucide-react";

import { useDropdown } from "@/components/account/use-dropdown";
import { useSession } from "@/components/auth/session-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { applications, reference, toApiError } from "@/lib/api";
import type { JobDetail } from "@/lib/jobs/types";

/**
 * Applying to a posting.
 *
 * `SaveHrRecruitmentOrderApp` attaches the applicant's saved anketa and CV
 * automatically, so this form only asks for the three things that are specific
 * to *this* application: salary expectation, earliest start date and where
 * they heard about the role. Everything else is a link back to the profile.
 */
export function ApplyDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { status, profile } = useSession();
  const pathname = usePathname();
  const sources = useDropdown(() => reference.sources(), [], open);

  const [salrequest, setSalrequest] = React.useState("");
  const [poshiredate, setPoshiredate] = React.useState("");
  const [recsourceid, setRecsourceid] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      window.setTimeout(() => {
        setError(null);
        setIsSent(false);
      }, 250);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!salrequest.trim()) {
      setError("Цалингийн хүлээлтээ оруулна уу.");
      return;
    }
    if (!poshiredate) {
      setError("Ажилд орох боломжтой огноогоо сонгоно уу.");
      return;
    }
    if (!recsourceid) {
      setError("Зарыг хаанаас мэдсэнээ сонгоно уу.");
      return;
    }

    setIsSending(true);
    try {
      await applications.apply({
        recruitmentorderid: Number(job.id),
        sourcetype: "WEB",
        salrequest: Number(salrequest),
        poshiredate,
        recsourceid: Number(recsourceid),
      });
      setIsSent(true);
    } catch (submitError) {
      setError(toApiError(submitError).message);
    } finally {
      setIsSending(false);
    }
  }

  const signInHref = `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        aria-describedby="apply-description"
      >
        {isSent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="bg-primary/10 flex size-11 items-center justify-center rounded-full">
              <Check className="text-primary size-5" />
            </span>
            <div className="space-y-2">
              <SheetTitle className="text-xl tracking-[-0.02em]">Анкет илгээгдлээ</SheetTitle>
              <SheetDescription className="text-pretty">
                «{job.title}» ажлын байранд илгээсэн анкетыг тань хүлээн авлаа. Явцыг
                «Илгээсэн хүсэлт» хэсгээс хянах боломжтой.
              </SheetDescription>
            </div>
            <div className="mt-2 flex gap-3">
              <Button asChild variant="outline" className="h-9 rounded-full px-5">
                <Link href="/account/applications">Хүсэлт харах</Link>
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-full px-5"
                onClick={() => handleOpenChange(false)}
              >
                Хаах
              </Button>
            </div>
          </div>
        ) : status !== "authenticated" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <div className="space-y-2">
              <SheetTitle className="text-xl tracking-[-0.02em]">
                Анкет илгээхийн тулд нэвтэрнэ үү
              </SheetTitle>
              <SheetDescription id="apply-description" className="text-pretty">
                Нэг удаа бүртгүүлээд анкетаа хадгалснаар дараагийн ажлын байранд хэдхэн
                товшилтоор өргөдөл гаргах боломжтой.
              </SheetDescription>
            </div>
            <div className="flex gap-3">
              <Button asChild className="h-10 rounded-full px-6">
                <Link href={signInHref}>Нэвтрэх</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-full px-6">
                <Link href="/register">Бүртгүүлэх</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <SheetHeader className="border-border/70 gap-1 border-b px-6 py-5">
              <SheetTitle className="text-lg tracking-[-0.02em]">
                {job.title}-д анкет илгээх
              </SheetTitle>
              <SheetDescription id="apply-description">
                {job.location} · {job.workType}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {!profile?.filename ? (
                <div className="border-border/70 bg-muted/40 flex gap-3 rounded-lg border p-4">
                  <FileWarning className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <p className="text-muted-foreground text-sm">
                    CV хавсаргаагүй байна.{" "}
                    <Link
                      href="/account/profile"
                      className="text-foreground underline underline-offset-4"
                    >
                      Профайлаас хавсаргах
                    </Link>{" "}
                    нь сонгон шалгаруулалтад давуу тал болно.
                  </p>
                </div>
              ) : null}

              <Field
                label="Цалингийн хүлээлт (₮)"
                htmlFor="salrequest"
                required
                hint={job.salaryLevel ? `Зарласан түвшин: ${job.salaryLevel}` : undefined}
              >
                <Input
                  id="salrequest"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50000}
                  placeholder="2000000"
                  value={salrequest}
                  onChange={(event) => setSalrequest(event.target.value)}
                />
              </Field>

              <Field label="Ажилд орох боломжтой огноо" htmlFor="poshiredate" required>
                <Input
                  id="poshiredate"
                  type="date"
                  value={poshiredate}
                  onChange={(event) => setPoshiredate(event.target.value)}
                />
              </Field>

              <Field label="Зарыг хаанаас мэдсэн бэ?" htmlFor="recsourceid" required>
                <Select
                  id="recsourceid"
                  value={recsourceid}
                  disabled={sources.isLoading}
                  onChange={(event) => setRecsourceid(event.target.value)}
                >
                  <option value="">{sources.isLoading ? "Ачаалж байна…" : "— Сонгох —"}</option>
                  {sources.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <FormMessage message={error} />
            </div>

            <SheetFooter className="border-border/70 mt-0 gap-3 border-t px-6 py-4">
              <Button
                type="submit"
                disabled={isSending}
                className="h-10 w-full rounded-full text-[0.9375rem]"
              >
                {isSending ? <Loader2 className="animate-spin" /> : null}
                Анкет илгээх
              </Button>
              <p className="text-muted-foreground text-center text-xs leading-relaxed">
                Илгээснээр таны хадгалсан анкет болон CV энэ ажлын байранд хавсрагдана.
              </p>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
