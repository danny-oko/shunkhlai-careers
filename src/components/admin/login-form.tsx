"use client";

import * as React from "react";
import { Loader2, LockKeyhole } from "lucide-react";

import { type LoginState, loginAction } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One field, because there is one account.
 *
 * `useActionState` keeps the error next to the input across the round trip
 * without a client-side copy of the rule that produced it — the server is the
 * only thing that knows whether a password is right, so it is the only thing
 * that says so.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = React.useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const errorId = React.useId();

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="next" value={next} />

      <Label htmlFor="password" className="text-[0.6875rem] tracking-[0.14em] uppercase">
        Нууц үг
      </Label>

      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? errorId : undefined}
        className="mt-2 h-11"
      />

      {state.error && (
        /* `role="alert"` so the failure is announced rather than only drawn —
           this is the one message on the page a screen reader must not miss. */
        <p id={errorId} role="alert" className="mt-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-5 h-11 w-full">
        {isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <LockKeyhole aria-hidden className="size-4" />
        )}
        {isPending ? "Шалгаж байна…" : "Нэвтрэх"}
      </Button>
    </form>
  );
}
