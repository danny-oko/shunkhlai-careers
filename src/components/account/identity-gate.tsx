"use client";

import * as React from "react";
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
  "Таны регистрийн дугаар болон утасны дугаар ERP системд бүртгэлтэй мэдээлэлтэй зөрж байна. ERP-д бүртгүүлсэн утасны дугаараа (эсвэл регистрээ) зөв оруулж хадгална уу. Зөв гэдэгт итгэлтэй бол «Хадгалах» дарж дахин оролдоно уу.";

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
      await profileApi.saveProfile(toInput({ ...toState(profile), ...values }), profile);
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
 * The /account banner: while one of the four is blank, or the ERP refused
 * them. `withForm` false (the profile page, whose form has the same fields):
 * the notice only, so a save here never races unsaved edits there.
 */
export const IdentityPanel = ({ withForm = true }: { withForm?: boolean }) => {
  const { blocked, linkError } = useIdentityReady();
  if (!blocked && !linkError) return null;
  return (
    <section
      aria-labelledby="identity-title"
      className="border-primary/30 bg-primary/5 mb-8 space-y-4 rounded-xl border p-5"
    >
      <div className="space-y-1">
        <h2 id="identity-title" className="text-base font-semibold tracking-[-0.02em]">
          {blocked ? "Эхлээд үндсэн мэдээллээ бөглөнө үү" : "ERP-ийн бүртгэлтэй зөрж байна"}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {blocked
            ? `${IDENTITY_REQUIRED_MESSAGE} Эдгээрээр таны бүртгэлийг ERP системд үүсгэдэг тул бөглөхөөс өмнө анкет хадгалах, файл хавсаргах, ажлын байранд хүсэлт илгээх боломжгүй.`
            : LINK_ERROR_TEXT}
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
