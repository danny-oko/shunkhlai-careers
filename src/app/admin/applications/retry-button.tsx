"use client";

import * as React from "react";
import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type DeskState, retryApplicationAction } from "./actions";

const IDLE: DeskState = {};

/**
 * One row's "retry" control.
 *
 * A form rather than an `onClick` fetch: the action is a POST that repeats
 * `requireAdmin()` on the server, and `useActionState` gives the pending state
 * and the server's own Mongolian message without this component inventing
 * either. The email and entry id ride in hidden fields because they identify
 * the row the server re-reads under its lock — the client is not trusted to
 * send anything else.
 */
export function RetryButton({ email, entryid }: { email: string; entryid: number }) {
  const [state, action, pending] = React.useActionState(retryApplicationAction, IDLE);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="entryid" value={entryid} />
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-8 rounded-full px-3">
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RotateCw className="size-3.5" aria-hidden />}
        {pending ? "Илгээж байна…" : "Дахин илгээх"}
      </Button>
      {state.message ? (
        <span
          role="status"
          className={state.tone === "error" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
