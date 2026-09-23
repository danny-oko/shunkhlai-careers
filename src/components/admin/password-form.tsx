"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";

import { changePasswordAction, type PasswordState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Three fields, all of them `type="password"`, none of them prefilled.
 *
 * The form is reset on success so the new password is not left sitting in the
 * DOM, and the confirmation replaces the error rather than joining it — there
 * is one outcome per submit, so there is one message.
 */
export function PasswordForm() {
  const [state, formAction, isPending] = React.useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );
  const messageId = React.useId();
  const form = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  return (
    <form ref={form} action={formAction} className="w-full max-w-sm">
      <Label htmlFor="current" className="text-[0.6875rem] tracking-[0.14em] uppercase">
        Одоогийн нууц үг
      </Label>
      <Input
        id="current"
        name="current"
        type="password"
        autoComplete="current-password"
        required
        className="mt-2 h-11"
      />

      <Label
        htmlFor="next"
        className="mt-5 block text-[0.6875rem] tracking-[0.14em] uppercase"
      >
        Шинэ нууц үг
      </Label>
      <Input
        id="next"
        name="next"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        className="mt-2 h-11"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">Дор хаяж 12 тэмдэгт.</p>

      <Label
        htmlFor="repeat"
        className="mt-5 block text-[0.6875rem] tracking-[0.14em] uppercase"
      >
        Шинэ нууц үг дахин
      </Label>
      <Input
        id="repeat"
        name="repeat"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error || state.ok ? messageId : undefined}
        className="mt-2 h-11"
      />

      {(state.error || state.ok) && (
        /* `role="alert"` so the outcome is announced rather than only drawn. */
        <p
          id={messageId}
          role="alert"
          className={`mt-2.5 text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state.error ?? "Нууц үг солигдлоо."}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-5 h-11 w-full">
        {isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <KeyRound aria-hidden className="size-4" />
        )}
        {isPending ? "Хадгалж байна…" : "Нууц үг солих"}
      </Button>
    </form>
  );
}
