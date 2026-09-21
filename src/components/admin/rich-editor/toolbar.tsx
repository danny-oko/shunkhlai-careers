"use client";

import * as React from "react";
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { Command, EditorSnapshot } from "./controller";
import { STRINGS } from "./strings";

/**
 * The formatting toolbar: a WAI-ARIA toolbar with one tab stop. Arrow keys,
 * Home and End move between the controls; Tab leaves. Pressed state is real
 * (`aria-pressed`) and follows the selection.
 *
 * It scrolls sideways rather than wrapping, so at 390px it is one 40px strip
 * and never covers the text it serves. Buttons keep `mousedown` from stealing
 * focus, so the writer's selection is still there when the command runs.
 */

type Tool = {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  command: Command;
  pressed?: (state: EditorSnapshot) => boolean;
  disabled?: (state: EditorSnapshot) => boolean;
};

const GROUPS: Tool[][] = [
  [
    { id: "bold", label: STRINGS.bold, shortcut: "Ctrl+B", icon: Bold, command: { type: "mark", mark: "bold" }, pressed: (s) => s.marks.includes("bold") },
    { id: "italic", label: STRINGS.italic, shortcut: "Ctrl+I", icon: Italic, command: { type: "mark", mark: "italic" }, pressed: (s) => s.marks.includes("italic") },
    { id: "underline", label: STRINGS.underline, shortcut: "Ctrl+U", icon: Underline, command: { type: "mark", mark: "underline" }, pressed: (s) => s.marks.includes("underline") },
    { id: "strike", label: STRINGS.strike, shortcut: "Ctrl+Shift+X", icon: Strikethrough, command: { type: "mark", mark: "strike" }, pressed: (s) => s.marks.includes("strike") },
    { id: "link", label: STRINGS.link, shortcut: "Ctrl+K", icon: Link2, command: { type: "link" }, pressed: (s) => s.link !== null },
  ],
  [
    { id: "bullet", label: STRINGS.bullet, icon: List, command: { type: "bullet" }, pressed: (s) => s.list === "bulletList" },
    { id: "numbered", label: STRINGS.numbered, icon: ListOrdered, command: { type: "numbered" }, pressed: (s) => s.list === "orderedList" },
    { id: "quote", label: STRINGS.quote, icon: Quote, command: { type: "quote" }, pressed: (s) => s.quote },
    { id: "divider", label: STRINGS.divider, icon: Minus, command: { type: "divider" } },
    { id: "image", label: STRINGS.image, icon: ImagePlus, command: { type: "image" } },
  ],
  [
    { id: "undo", label: STRINGS.undo, shortcut: "Ctrl+Z", icon: Undo2, command: { type: "undo" }, disabled: (s) => !s.canUndo },
    { id: "redo", label: STRINGS.redo, shortcut: "Ctrl+Shift+Z", icon: Redo2, command: { type: "redo" }, disabled: (s) => !s.canRedo },
    { id: "clear", label: STRINGS.clear, icon: RemoveFormatting, command: { type: "clear" } },
  ],
];

const BUTTON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-foreground transition-colors motion-reduce:transition-none sm:size-8 " +
  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none " +
  "disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-foreground aria-pressed:text-background";

export function Toolbar({
  state,
  onCommand,
  popover,
}: {
  state: EditorSnapshot;
  onCommand(command: Command): void;
  /** Rendered outside the scroller, so it is not clipped by it. */
  popover?: React.ReactNode;
}) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [current, setCurrent] = React.useState(0);

  const tools = () => Array.from(barRef.current?.querySelectorAll<HTMLElement>("[data-tool]") ?? []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.target as HTMLElement).tagName === "SELECT") return;
    const all = tools().filter((el) => !(el as HTMLButtonElement).disabled);
    const at = all.indexOf(event.target as HTMLElement);
    if (at === -1) return;

    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % all.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + all.length) % all.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = all.length - 1;
    if (next === -1) return;

    event.preventDefault();
    all[next].focus();
    setCurrent(tools().indexOf(all[next]));
  };

  const heading = state.heading;

  // One tab stop: the control last used, or the first usable one when that
  // control is disabled right now (undo before any edit, headings in a list).
  const flags = [!state.canHeading, ...GROUPS.flat().map((tool) => Boolean(tool.disabled?.(state)))];
  const stop = flags[current] === false ? current : Math.max(0, flags.indexOf(false));
  let index = 1;

  return (
    <div className="relative border-b border-border bg-background">
      <div
        ref={barRef}
        role="toolbar"
        aria-label={STRINGS.toolbarLabel}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex items-center gap-0.5 overflow-x-auto overscroll-x-contain px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <select
          data-tool
          tabIndex={stop === 0 ? 0 : -1}
          aria-label={STRINGS.headingLabel}
          title={STRINGS.headingLabel}
          value={heading === null ? "" : String(heading)}
          disabled={!state.canHeading}
          onFocus={() => setCurrent(0)}
          onChange={(event) => onCommand({ type: "heading", level: Number(event.target.value) as 0 | 1 | 2 | 3 })}
          className="h-9 max-w-[9.5rem] shrink-0 rounded-sm border border-transparent bg-transparent px-1.5 text-[0.8125rem] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40 sm:h-8"
        >
          {heading === null && <option value="" disabled />}
          {([0, 1, 2, 3] as const).map((level) => (
            <option key={level} value={level}>
              {STRINGS.headings[level]}
            </option>
          ))}
        </select>

        {GROUPS.map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            <span role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px shrink-0 bg-border" />
            {group.map((tool) => {
              const position = index++;
              const pressed = tool.pressed?.(state);
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  data-tool
                  tabIndex={stop === position ? 0 : -1}
                  aria-label={tool.label}
                  aria-pressed={tool.pressed ? Boolean(pressed) : undefined}
                  aria-haspopup={tool.id === "link" || tool.id === "image" ? "dialog" : undefined}
                  title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                  disabled={tool.disabled?.(state)}
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setCurrent(position)}
                  onClick={() => onCommand(tool.command)}
                  className={cn(BUTTON)}
                >
                  <Icon aria-hidden className="size-4" />
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {popover}
    </div>
  );
}
