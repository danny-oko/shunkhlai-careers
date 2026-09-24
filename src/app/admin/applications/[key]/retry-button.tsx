"use client";

import * as React from "react";
import { Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type DeskState, retryApplicationAction } from "../actions";

const IDLE: DeskState = {};

/**
 * «Дахин илгээх» — the desk's only write.
 *
 * A form rather than an `onClick` fetch: the action is a POST that repeats
 * `requireAdminUser()` and the `admin` role check on the server, and
 * `useActionState` gives the pending state and the server's own Mongolian
 * message without this component inventing either.
 *
 * The only thing that rides in the form is the application's key — the
 * idempotency hash that is already on the row. The account behind it is looked
 * up server-side, so no email is ever in the page source, and the client is
 * not trusted to name an applicant.
 */
export function RetryButton({ applicationKey }: { applicationKey: string }) {
  const [state, action, pending] = React.useActionState(retryApplicationAction, IDLE);

  return (
    <form action={action} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="key" value={applicationKey} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <RotateCw aria-hidden />
        )}
        {pending ? "Илгээж байна…" : "Дахин илгээх"}
      </Button>
      {state.message && (
        <span
          role="status"
          className={
            state.tone === "error"
              ? "text-[0.75rem] text-destructive"
              : "text-[0.75rem] text-muted-foreground"
          }
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
