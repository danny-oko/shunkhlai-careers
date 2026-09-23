"use client";

import * as React from "react";
import { Loader2, LockKeyhole } from "lucide-react";

import { type LoginState, loginAction } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Email and password, because staff now have accounts of their own.
 *
 * `useActionState` keeps the error next to the input across the round trip
 * without a client-side copy of the rule that produced it — the server is the
 * only thing that knows whether a password is right, so it is the only thing
 * that says so. Nothing here validates the email beyond `type="email"`: a
 * client-side "no such account" would be the enumeration hole the server goes
 * out of its way not to have.
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

      <Label htmlFor="email" className="text-[0.6875rem] tracking-[0.14em] uppercase">
        И-мэйл
      </Label>

      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? errorId : undefined}
        className="mt-2 h-11"
      />

      <Label
        htmlFor="password"
        className="mt-5 block text-[0.6875rem] tracking-[0.14em] uppercase"
      >
        Нууц үг
      </Label>

      <Input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
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
