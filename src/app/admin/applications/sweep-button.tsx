"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type DeskState, sweepAction } from "./actions";

const IDLE: DeskState = {};

/**
 * Runs the sweep by hand.
 *
 * The sweep is meant to be a cron tick (`docs/applications.md`); this button
 * exists so the desk is useful before that cron is wired up on the customer's
 * server, and so an admin looking at a stuck list can act on the whole list at
 * once rather than row by row. Pressing it while another sweep runs is safe —
 * the lease in `sweepStuckApplications` is what makes it so.
 */
export function SweepButton() {
  const [state, action, pending] = React.useActionState(sweepAction, IDLE);

  return (
    <form action={action} className="flex items-center gap-3">
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
        {pending ? "Шалгаж байна…" : "Бүгдийг шалгах"}
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
