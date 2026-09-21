"use client";

import * as React from "react";

export const DISCARD_MESSAGE = "Хадгалаагүй өөрчлөлт устах болно. Гарах уу?";

/** Asks before an in-app navigation throws away edits; true means proceed. */
export function confirmDiscard(
  active: boolean,
  ask: (message: string) => boolean = (m) => window.confirm(m),
): boolean {
  return active ? ask(DISCARD_MESSAGE) : true;
}

type Target = Pick<Window, "addEventListener" | "removeEventListener">;

/** Installs a beforeunload prompt; returns its remover. */
export function installUnloadGuard(target: Target = window): () => void {
  const handler = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    // Legacy browsers still require returnValue to be set.
    event.returnValue = "";
  };
  target.addEventListener("beforeunload", handler);
  return () => target.removeEventListener("beforeunload", handler);
}

/** Active only while `active`; removed on deactivation and unmount. */
export function useUnloadGuard(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    return installUnloadGuard();
  }, [active]);
}
