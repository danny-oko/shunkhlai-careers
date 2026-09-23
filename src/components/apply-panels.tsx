"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Check } from "lucide-react";

import { IdentityForm } from "@/components/account/identity-gate";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { JobDetail } from "@/lib/jobs/types";

/** What the sheet shows instead of the form: confirmation, or a request to sign in. */

export const SentPanel = ({ job, onClose }: { job: JobDetail; onClose: () => void }) => (
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
      <Button variant="ghost" className="h-9 rounded-full px-5" onClick={onClose}>
        Хаах
      </Button>
    </div>
  </div>
);

/**
 * `onClose` shuts the sheet on the way to Clerk's dialog, and it is not
 * optional: the sheet is a Radix dialog with a focus trap, and a Clerk modal
 * opened underneath one renders but cannot be typed into - the trap pulls
 * focus straight back to the sheet. `SignInButton` runs this `onClick` before
 * it opens, so the sheet is already closing by then.
 */
export const SignInPanel = ({ onClose }: { onClose: () => void }) => {
  return (
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
        <SignInButton mode="modal">
          <Button className="h-10 rounded-full px-6" onClick={onClose}>
            Нэвтрэх
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button
            variant="outline"
            className="h-10 rounded-full px-6"
            onClick={onClose}
          >
            Бүртгүүлэх
          </Button>
        </SignUpButton>
      </div>
    </div>
  );
};

/** Signed in, but регистр / овог / нэр / утас are not stored yet: fill them here first. */
export const IdentityPanel = () => (
  <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-8">
    <div className="space-y-2">
      <SheetTitle className="text-xl tracking-[-0.02em]">Эхлээд үндсэн мэдээллээ бөглөнө үү</SheetTitle>
      <SheetDescription id="apply-description" className="text-pretty">
        Анкет илгээхийн өмнө регистр, овог, нэр, утасны дугаараа оруулна уу. Эдгээрээр таны
        бүртгэлийг ERP системд үүсгэнэ.
      </SheetDescription>
    </div>
    <IdentityForm />
  </div>
);
