"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { STRINGS } from "./strings";
import type { SlashId } from "./shortcuts";
import type { SlashState } from "./controller";

/**
 * The `/` menu.
 *
 * The editor keeps focus the whole time — the menu is driven from the
 * editor's keydown (arrows, Enter, Tab, Escape) and announced through
 * `aria-activedescendant` on the textbox, the combobox-with-listbox pattern.
 * Pointer selection uses `mousedown` with `preventDefault`, so clicking an item
 * never takes focus away from the text it is about to change.
 */

export const slashOptionId = (menuId: string, index: number) => `${menuId}-option-${index}`;

export function SlashMenu({
  id,
  state,
  onPick,
}: {
  id: string;
  state: SlashState;
  onPick(id: SlashId): void;
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={STRINGS.slash.menuLabel}
      style={{ top: state.top, left: state.left }}
      className="absolute z-30 max-h-64 w-[min(18rem,calc(100vw-2.5rem))] overflow-y-auto border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {state.items.length === 0 && (
        <p role="option" aria-selected="false" aria-disabled className="px-2.5 py-2 text-[0.8125rem] text-muted-foreground">
          {STRINGS.slash.empty}
        </p>
      )}
      {state.items.map((item, index) => (
        <div
          key={item.id}
          id={slashOptionId(id, index)}
          role="option"
          aria-selected={index === state.index}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item.id);
          }}
          className={cn(
            "flex cursor-pointer flex-col px-2.5 py-1.5 text-[0.8125rem]",
            index === state.index ? "bg-foreground text-background" : "hover:bg-muted",
          )}
        >
          <span className="font-medium">{item.label}</span>
          <span
            className={cn(
              "text-[0.6875rem]",
              index === state.index ? "text-background/70" : "text-muted-foreground",
            )}
          >
            {item.hint}
          </span>
        </div>
      ))}
    </div>
  );
}
