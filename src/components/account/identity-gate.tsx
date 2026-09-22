"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { TextField } from "@/components/account/profile-fields";
import { toInput, toState } from "@/components/account/profile-form-state";
import { PHONE_HINT } from "@/components/account/profile-sections";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { profile as profileApi, toApiError } from "@/lib/api";
import {
  type Identity,
  IDENTITY_REQUIRED_MESSAGE,
  identityProblem,
  isIdentityComplete,
} from "@/lib/applicant-identity";
import { cn } from "@/lib/utils";

/**
 * The регистр / овог / нэр / утас gate. The ERP creates the applicant from
 * those four (SaveHrAppUser), so until they are stored nothing ERP-backed is
 * offered: `/api/me` refuses the writes (`server/applicant/identity-gate.ts`)
 * and the UI says why and lets the applicant fill them right there.
 */

/**
 * `ready`: the profile has loaded with all four fields (or could not be read
 * at all — then the server decides). `blocked`: it has
 * loaded without them (a still-loading profile is neither — controls stay
 * disabled, but no prompt flashes). `linkError`: the ERP refused the stored
 * регистр + утас.
 */
export function useIdentityReady() {
  const { profile, profileFailed } = useSession();
  const known = profile !== null;
  // A failed read gates nothing here (no endless disabled page): the server
  // gate still refuses writes while the four are blank.
  const ready = profileFailed || (known && isIdentityComplete(profile));
  return { known, ready, blocked: known && !ready, linkError: profile?.erplinkerror ?? null };
}

const LINK_ERROR_TEXT =
  "ERP системд утасны дугаар тань нууц үг болдог. Тэнд бүртгүүлсэн утасны дугаараа (нууц үгээ сольсон бол шинэ нууц үгээ) «Утас» талбарт оруулж хадгална уу. Засах хүртэл анкет, хүсэлт тань ERP системд очихгүй. Зөв гэдэгт итгэлтэй бол «Дахин оролдох» дарна уу.";

/** The same stored profile sent back with the retry flag (`RETRY_LINK_FLAG`). */
function useRetryLink() {
  const { profile, refresh } = useSession();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function retry() {
    setError(null);
    setIsRetrying(true);
    try {
      await profileApi.saveProfile(toInput(toState(profile)), profile, { retryLink: true });
      toast.success("Хадгаллаа. ERP системд удахгүй дахин шалгана.");
      await refresh();
    } catch (retryError) {
      setError(toApiError(retryError).message);
    } finally {
      setIsRetrying(false);
    }
  }

  return { retry, isRetrying, error };
}

const pick = (source: Record<string, unknown> | null): Identity => {
  const read = (key: keyof Identity) => String(source?.[key] ?? "");
  return {
    regno: read("regno"),
    lastname: read("lastname"),
    firstname: read("firstname"),
    mobilephone: read("mobilephone"),
  };
};

/** The four fields and a save; every other profile field is sent back as loaded. */
export const IdentityForm = ({ className }: { className?: string }) => {
  const { profile, refresh } = useSession();
  const { linkError } = useIdentityReady();
  const [values, setValues] = React.useState<Identity>(() => pick(profile));
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const linked = profile?.erplinked === true;

  const set = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = identityProblem(values, profile);
    setError(problem);
    if (problem) return;

    setIsSaving(true);
    try {
      // The same full-replace body the profile form sends, with the four overlaid.
      // Saving here while the ERP refuses them is the deliberate retry.
      await profileApi.saveProfile(toInput({ ...toState(profile), ...values }), profile, {
        retryLink: !!linkError,
      });
      toast.success("Мэдээлэл хадгалагдлаа");
      await refresh();
    } catch (saveError) {
      setError(toApiError(saveError).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="regno"
          label="Регистрийн дугаар"
          values={values}
          set={set}
          required
          readOnly={linked}
          hint="Жишээ нь УБ99010101"
        />
        <TextField name="mobilephone" label="Утас" values={values} set={set} required type="tel" hint={PHONE_HINT} />
        <TextField name="lastname" label="Овог (эцэг/эхийн нэр)" values={values} set={set} required />
        <TextField name="firstname" label="Нэр" values={values} set={set} required />
      </div>
      <FormMessage message={error} />
      <Button type="submit" disabled={isSaving} className="h-10 rounded-full px-6">
        {isSaving ? <Loader2 className="animate-spin" /> : null}
        Хадгалах
      </Button>
    </form>
  );
};

/**
 * The ERP refused the stored регистр + утас: its own message, what to do, and
 * the ways out — fix утас (`fixHref`, or the form right here with `withForm`)
 * or deliberately retry the same pair. One component for /account and the
 * apply sheet, so the refusal shows wherever the applicant acts.
 */
export const LinkErrorNotice = ({
  withForm = false,
  fixHref,
  className,
}: {
  withForm?: boolean;
  fixHref?: string;
  className?: string;
}) => {
  const { linkError } = useIdentityReady();
  const { retry, isRetrying, error } = useRetryLink();
  if (!linkError) return null;
  return (
    <section
      aria-labelledby="link-error-title"
      className={cn("border-destructive/30 bg-destructive/5 space-y-4 rounded-xl border p-5", className)}
    >
      <div className="space-y-1">
        <h2 id="link-error-title" className="text-base font-semibold tracking-[-0.02em]">
          ERP-ийн бүртгэлтэй зөрж байна
        </h2>
        <p className="text-sm font-medium text-pretty">{linkError}</p>
        <p className="text-muted-foreground text-sm text-pretty">{LINK_ERROR_TEXT}</p>
      </div>
      {withForm ? <IdentityForm /> : null}
      <div className="flex flex-wrap gap-3">
        {fixHref ? (
          <Button asChild className="h-9 rounded-full px-5">
            <Link href={fixHref}>Утасны дугаараа засах</Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={isRetrying}
          onClick={retry}
          className="h-9 rounded-full px-5"
        >
          {isRetrying ? <Loader2 className="animate-spin" /> : null}
          Дахин оролдох
        </Button>
      </div>
      <FormMessage message={error} />
    </section>
  );
};

/**
 * The /account banner: while one of the four is blank, or the ERP refused
 * them. `withForm` false (the profile page, whose form has the same fields):
 * the notice only, so a save here never races unsaved edits there.
 */
export const IdentityPanel = ({ withForm = true }: { withForm?: boolean }) => {
  const { blocked, linkError } = useIdentityReady();
  if (!blocked && linkError) return <LinkErrorNotice withForm={withForm} className="mb-8" />;
  if (!blocked) return null;
  return (
    <section
      aria-labelledby="identity-title"
      className="border-primary/30 bg-primary/5 mb-8 space-y-4 rounded-xl border p-5"
    >
      <div className="space-y-1">
        <h2 id="identity-title" className="text-base font-semibold tracking-[-0.02em]">
          Эхлээд үндсэн мэдээллээ бөглөнө үү
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {`${IDENTITY_REQUIRED_MESSAGE} Эдгээрээр таны бүртгэлийг ERP системд үүсгэдэг тул бөглөхөөс өмнө анкет хадгалах, файл хавсаргах, ажлын байранд хүсэлт илгээх боломжгүй.`}
        </p>
      </div>
      {withForm ? <IdentityForm /> : null}
    </section>
  );
};

/**
 * Disables every control inside until the profile has loaded with all four
 * (one shared switch; disabled while loading too, so nothing flips enabled →
 * locked). Dimmed only when actually blocked.
 */
export const IdentityLock = ({ children }: { children: React.ReactNode }) => {
  const { ready, blocked } = useIdentityReady();
  return (
    <fieldset
      disabled={!ready}
      aria-describedby={blocked ? "identity-title" : undefined}
      className={cn("m-0 min-w-0 border-0 p-0", blocked && "opacity-60")}
    >
      {children}
    </fieldset>
  );
};
