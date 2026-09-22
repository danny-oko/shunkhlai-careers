"use client";

import * as React from "react";

import type { ImageAttrs, RichDoc } from "@/lib/news/shared/rich-text";
import { cn } from "@/lib/utils";

import {
  type Command,
  type Controller,
  EMPTY_SNAPSHOT,
  type EditorSnapshot,
  type ImageRequest,
  type LinkRequest,
  createController,
} from "./controller";
import { ImagePopover, LinkPopover } from "./popovers";
import { SlashMenu, slashOptionId } from "./slash-menu";
import { STRINGS } from "./strings";
import { Toolbar } from "./toolbar";
import { cleanForSave } from "./model";
import { prepareDoc } from "./commands";

/**
 * A rich-text editor built for this newsroom, with no editor library.
 *
 * What it edits is a `RichDoc` — the format `sanitizeDoc` defines — so what the
 * editor can produce and what the site will render are the same set by
 * construction. The editing model (the DOM is a view the browser may edit;
 * structure is done as transactions on the document) is described at the top of
 * `controller.ts`; this file is only the React shell: the surface, the toolbar,
 * the slash menu, the two popovers, and a hidden input that carries the
 * sanitised document as JSON to the server action.
 *
 * It is uncontrolled: `initialDoc` is read once. Remount it (a `key`) to load a
 * different document.
 */

type Popover = ({ kind: "link" } & LinkRequest) | ({ kind: "image" } & ImageRequest);

const SURFACE = cn(
  "news-body relative min-h-[22rem] px-4 py-3 text-[1.0625rem] whitespace-pre-wrap outline-none",
  "[&_p]:my-2 [&_li>p]:my-0",
  "[&_h1]:news-headline [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-[1.5rem]",
  "[&_h2]:news-headline [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[1.25rem]",
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-serif [&_h3]:text-[1.0625rem] [&_h3]:font-semibold",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-l-[var(--paper-accent)] [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_a]:underline [&_a]:decoration-[var(--paper-accent)] [&_a]:underline-offset-2",
  "[&_hr]:my-6 [&_hr]:h-px [&_hr]:border-0 [&_hr]:bg-[var(--rule-strong)]",
  "[&_figure]:my-4 [&_figure_img]:h-auto [&_figure_img]:max-w-full [&_figure_img]:border [&_figure_img]:border-border",
  "[&_figcaption]:mt-1.5 [&_figcaption]:font-sans [&_figcaption]:text-[0.8125rem] [&_figcaption]:text-muted-foreground",
  "[&_[data-atom]]:cursor-pointer [&_[data-atom]]:outline-none",
  "[&_[data-atom]:focus-visible]:ring-3 [&_[data-atom]:focus-visible]:ring-ring/50 [&_[data-selected]]:ring-2 [&_[data-selected]]:ring-[var(--paper-accent)]",
  "[&_hr[data-atom]]:py-1.5 [&_hr[data-atom]]:bg-clip-content",
);

export function RichEditor({
  name,
  labelId,
  describedBy,
  invalid,
  initialDoc,
  onChange,
  className,
}: {
  /** Name of the hidden input that carries the document to the server. */
  name: string;
  /** Id of the field's visible label, for `aria-labelledby`. */
  labelId: string;
  describedBy?: string;
  invalid?: boolean;
  initialDoc: RichDoc;
  onChange?(doc: RichDoc): void;
  className?: string;
}) {
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const controllerRef = React.useRef<Controller | null>(null);
  const onChangeRef = React.useRef(onChange);
  const baseId = React.useId();
  const menuId = `${baseId}-slash`;

  const [state, setState] = React.useState<EditorSnapshot>(EMPTY_SNAPSHOT);
  const [popover, setPopover] = React.useState<Popover | null>(null);
  const [json, setJson] = React.useState(() =>
    JSON.stringify(cleanForSave(prepareDoc(initialDoc))),
  );

  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  React.useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const controller = createController(surface, {
      initialDoc,
      onChange: (doc) => {
        setJson(JSON.stringify(doc));
        onChangeRef.current?.(doc);
      },
      onState: setState,
      onLink: (request) => setPopover({ kind: "link", ...request }),
      onImage: (request) => setPopover({ kind: "image", ...request }),
    });
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
    // `initialDoc` is deliberately read once: the editor owns the document after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePopover = () => {
    setPopover(null);
    controllerRef.current?.focus();
  };

  const onCommand = (command: Command) => {
    setPopover(null);
    controllerRef.current?.command(command);
  };

  const slash = state.slash;

  return (
    <div
      className={cn(
        "border border-input bg-background transition-colors motion-reduce:transition-none",
        "focus-within:border-ring",
        invalid && "border-destructive",
        className,
      )}
    >
      <input type="hidden" name={name} value={json} />

      {/* Sticks under the article's action bar while the body scrolls.
          `--action-bar-h` is measured by the form; the fallback is its height
          on a wide screen. */}
      <div className="sticky top-[calc(3.5rem+var(--action-bar-h,3.25rem))] z-20">
        <Toolbar
          state={state}
          onCommand={onCommand}
          popover={
            popover?.kind === "link" ? (
              <LinkPopover
                initial={popover.current}
                onApply={(link) => {
                  controllerRef.current?.applyLink(popover.sel, link);
                  setPopover(null);
                }}
                onRemove={() => {
                  controllerRef.current?.applyLink(popover.sel, null);
                  setPopover(null);
                }}
                onCancel={closePopover}
              />
            ) : popover?.kind === "image" ? (
              <ImagePopover
                initial={popover.attrs}
                onApply={(attrs: ImageAttrs) => {
                  controllerRef.current?.applyImage(popover, attrs);
                  setPopover(null);
                }}
                onRemove={() => {
                  controllerRef.current?.removeImage(popover);
                  setPopover(null);
                }}
                onCancel={closePopover}
              />
            ) : null
          }
        />
      </div>

      <div className="relative">
        {state.empty && (
          <p
            aria-hidden
            className="news-body pointer-events-none absolute top-3 left-4 text-[1.0625rem] text-muted-foreground/70"
          >
            {STRINGS.placeholder}
          </p>
        )}

        <div
          ref={surfaceRef}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-placeholder={STRINGS.placeholder}
          aria-haspopup="listbox"
          aria-controls={slash ? menuId : undefined}
          aria-activedescendant={slash && slash.items.length > 0 ? slashOptionId(menuId, slash.index) : undefined}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          lang="mn"
          className={SURFACE}
        />

        {slash && (
          <SlashMenu
            id={menuId}
            state={slash}
            onPick={(id) => controllerRef.current?.slashPick(id)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-3 py-1.5 text-[0.6875rem] text-muted-foreground">
        <span>{STRINGS.slashHint}</span>
        <span className="tabular-nums">
          {STRINGS.words(state.words)} · {STRINGS.reading(state.minutes)}
        </span>
      </div>
    </div>
  );
}
