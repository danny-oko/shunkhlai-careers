"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import type { ContentActionState } from "@/app/admin/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DISCARD_MESSAGE, useUnloadGuard } from "@/components/admin/unsaved-guard";
import { cn } from "@/lib/utils";

/**
 * The furniture every section form on `/admin/content` is built from.
 *
 * Three forms, one look: a titled panel that says where on the site it comes
 * out, a preview of what is being edited, the fields, and a save bar pinned to
 * the foot of the panel. They are separate `<form>`s rather than one form with
 * three panels so that saving the footer cannot fail on something typed in the
 * hero — each section is its own row in `site_content` and its own
 * all-or-nothing save.
 *
 * What changed from the first pass: the three sections used to be hairline
 * rules in one continuous scroll, with the save button at the *top* of each —
 * so the button an admin needed was off-screen by the time they had filled in
 * the fields it belonged to, and there was no boundary telling them which
 * fields that button was going to write. Each section is now a closed panel
 * with its own foot.
 *
 * The controls here are secondary controls, and are sized as such: 38px tall,
 * 13px type, which is the size the newsroom's "image link" field already uses
 * and noticeably tighter than the shadcn defaults these wrap. A content desk
 * is a dense list of short strings; full-size inputs turn twenty of them into
 * a page of scrolling. The save button is the exception — it keeps 14px type,
 * because it is the panel's primary action and not part of that chrome.
 */

/** The compact field size, shared so the three forms cannot drift apart. */
export const CONTROL = "h-[38px] text-[0.8125rem] md:text-[0.8125rem]";

/** One labelled input, with the message for its own field under it. */
export function Field({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  className,
  inputClassName,
  multiline,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** A paragraph rather than a line - it grows with what is typed. */
  multiline?: boolean;
}) {
  const id = `content-${name.replace(/\./gu, "-")}`;
  const control = {
    id,
    name,
    value,
    placeholder,
    autoComplete: "off",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-[0.6875rem] tracking-[0.14em] uppercase">
        {label}
      </Label>
      {multiline ? (
        <Textarea
          {...control}
          onChange={(event) => onChange(event.target.value)}
          className={cn("text-[0.8125rem] md:text-[0.8125rem]", inputClassName)}
        />
      ) : (
        <Input
          {...control}
          onChange={(event) => onChange(event.target.value)}
          className={cn(CONTROL, inputClassName)}
        />
      )}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-[0.75rem] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * A named run of fields inside a section — the slides, the contact column, the
 * figures.
 *
 * It is a real `<fieldset>` with a real `<legend>`, so the run has a name in
 * the accessibility tree as well as on the page, and it is ruled off from the
 * fields above it. The explanatory line sits under the legend rather than
 * beside it: it is an instruction, and an instruction reads before the rows it
 * governs, not after them.
 */
export function FieldGroup({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-5">
      <legend className="px-0 text-[0.6875rem] tracking-[0.14em] uppercase">{legend}</legend>
      {hint && (
        <p className="-mt-1.5 max-w-prose text-[0.75rem] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
    </fieldset>
  );
}

/**
 * One row of a repeatable list: a numbered strip with the row's controls, and
 * the row's fields under it.
 *
 * The number is not decoration. All three lists are printed **in the order
 * they are kept** — the hero cycles its slides, the footer prints its contact
 * column top to bottom, the About tiles run left to right — so "this is the
 * second one" is the single most useful thing the row can say, and it is what
 * makes the two move controls beside it mean anything.
 *
 * Before this, a row was fields and a bin icon with no head and no boundary;
 * three slides were nine inputs in a column, and the only way to reorder them
 * was to retype their contents into each other.
 */
export function Row({
  index,
  total,
  removeLabel,
  onRemove,
  onMove,
  children,
}: {
  index: number;
  total: number;
  removeLabel: string;
  onRemove: () => void;
  onMove: (to: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-muted/30">
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        <span className="text-[0.6875rem] font-semibold tabular-nums">{index + 1}</span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
          aria-label={`${index + 1}-р мөрийг дээш зөөх`}
          title="Дээш зөөх"
          className="text-muted-foreground"
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          disabled={index === total - 1}
          onClick={() => onMove(index + 1)}
          aria-label={`${index + 1}-р мөрийг доош зөөх`}
          title="Доош зөөх"
          className="text-muted-foreground"
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-3">{children}</div>
    </div>
  );
}

export function RowAdd({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(CONTROL, "w-fit")}
    >
      <Plus aria-hidden />
      {label}
    </Button>
  );
}

/**
 * A list of rows an admin can add to, edit, remove and reorder.
 *
 * The row's key is a counter and not its index: keyed by index, removing the
 * first of three slides makes React re-use the removed row's DOM for the one
 * that took its place, which shows up as the wrong text left in an input.
 * Moving a row has the same hazard and the same answer.
 *
 * Nothing on the server had to learn about the order. The inputs are named
 * from the array position (`slides.1.caption`), and `formDocument` reads the
 * indices off those names and sorts them — so moving a row in this array *is*
 * the reorder, posted as it always was.
 *
 * `onMutate` is how add / remove / move reach the section's "unsaved changes"
 * flag: typing is caught by one `onChange` on the `<form>`, but a button that
 * rearranges React state fires no such event.
 */
export function useRows<T>(
  initial: T[],
  onMutate?: () => void,
): {
  rows: Array<{ id: number; value: T }>;
  add: (value: T) => void;
  remove: (id: number) => void;
  move: (id: number, to: number) => void;
  update: (id: number, patch: Partial<T>) => void;
} {
  const nextId = React.useRef(initial.length);
  const [rows, setRows] = React.useState(() =>
    initial.map((value, index) => ({ id: index, value })),
  );

  const mutate = (next: (current: Array<{ id: number; value: T }>) => Array<{ id: number; value: T }>) => {
    setRows(next);
    onMutate?.();
  };

  return {
    rows,
    add: (value) => mutate((current) => [...current, { id: nextId.current++, value }]),
    remove: (id) => mutate((current) => current.filter((row) => row.id !== id)),
    move: (id, to) =>
      mutate((current) => {
        const from = current.findIndex((row) => row.id === id);
        // A move off either end is not an error, it is a no-op: the controls
        // are disabled at the ends, and a keyboard repeat can still ask.
        if (from === -1 || to < 0 || to >= current.length) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }),
    update: (id, patch) =>
      mutate((current) =>
        current.map((row) => (row.id === id ? { ...row, value: { ...row.value, ...patch } } : row)),
      ),
  };
}

/* --- the save bar --------------------------------------------------------- */

/**
 * Whether the form has unsaved edits.
 *
 * The phrase is lifted whole out of the newsroom's discard prompt
 * (`DISCARD_MESSAGE`, "Хадгалаагүй өөрчлөлт устах болно. Гарах уу?") rather
 * than written again, so the desk calls the same condition the same thing in
 * both places.
 */
const UNSAVED = DISCARD_MESSAGE.split(" устах")[0];

type Status =
  | { tone: "busy" | "ok" | "error" | "dirty" | "quiet"; text: string }
  | null;

/**
 * What the save bar says, in the order an admin needs to hear it.
 *
 * A request in flight outranks everything; a refusal outranks a success that
 * has since been edited over; "saved" is only true while nothing has been
 * typed since. Last comes the standing note that this section has never been
 * written at all — true from the moment the page loads, and the least urgent
 * of the five.
 */
function statusOf({
  isPending,
  mine,
  state,
  dirty,
  stored,
}: {
  isPending: boolean;
  mine: boolean;
  state: ContentActionState;
  dirty: boolean;
  stored: boolean;
}): Status {
  if (isPending) return { tone: "busy", text: "Хадгалж байна…" };
  if (mine && state.message && !state.ok) return { tone: "error", text: state.message };
  if (mine && state.ok && !dirty) return { tone: "ok", text: state.message ?? "Хадгалагдлаа." };
  if (dirty) return { tone: "dirty", text: UNSAVED };
  if (!stored) {
    return {
      tone: "quiet",
      text: "Хадгалаагүй - одоогоор кодод бичигдсэн эх хувилбар харагдаж байна.",
    };
  }
  return null;
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;

  const Icon =
    status.tone === "busy"
      ? Loader2
      : status.tone === "ok"
        ? CheckCircle2
        : status.tone === "error"
          ? AlertTriangle
          : Pencil;

  return (
    <p
      // Announced rather than alerted for the states that are not failures:
      // an admin does not need the screen reader to interrupt them to say a
      // save is under way.
      role={status.tone === "error" ? "alert" : "status"}
      className={cn(
        "flex min-w-0 items-center gap-2 text-[0.8125rem]",
        status.tone === "error" && "text-destructive",
        status.tone === "ok" && "text-foreground",
        (status.tone === "busy" || status.tone === "dirty" || status.tone === "quiet") &&
          "text-muted-foreground",
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", status.tone === "busy" && "animate-spin")}
      />
      <span className="min-w-0">{status.text}</span>
    </p>
  );
}

/* --- the panel ------------------------------------------------------------ */

/**
 * One section, as a closed panel: head, preview, fields, save bar.
 *
 * `section` rides as a hidden field because all three forms post to the same
 * action — it is what tells the action which schema to parse against and which
 * row to write.
 *
 * The head carries the one thing the old stack never said plainly: **where
 * this copy comes out**. The blurb describes it in words and the chip beside
 * it is the address itself, opening the live page in a new tab — so "the
 * footer" is not a thing an admin has to hold in their head while they edit
 * it.
 *
 * The save bar is `sticky bottom-0`: the hero section is taller than a laptop
 * screen, and a save button that scrolls away is a save button that gets
 * looked for. It sits *inside* the panel, so it is unambiguous which of the
 * three sections it writes.
 */
export function SectionShell({
  section,
  title,
  blurb,
  href,
  stored,
  state,
  isPending,
  dirty,
  onDirty,
  action,
  preview,
  children,
}: {
  section: string;
  title: string;
  blurb: string;
  /** The public page this section is printed on. */
  href: string;
  /** False while the section still shows the values it shipped with. */
  stored: boolean;
  state: ContentActionState;
  isPending: boolean;
  dirty: boolean;
  onDirty: () => void;
  action: (formData: FormData) => void;
  preview: React.ReactNode;
  children: React.ReactNode;
}) {
  // The action is shared, so an outcome is only this form's when it says so.
  const mine = state.section === section;
  const formError = mine ? state.fieldErrors?.form : undefined;
  const status = statusOf({ isPending, mine, state, dirty, stored });
  // Each section is its own screen, so leaving it with edits loses them.
  useUnloadGuard(dirty && !isPending);

  return (
    <form
      id={section}
      action={action}
      // One listener for every input in the panel. `change` bubbles, so this
      // catches typing in a field that was added after the form mounted
      // without a `markDirty` threaded through twenty callbacks.
      onChange={onDirty}
      aria-labelledby={`${section}-title`}
      className="scroll-mt-24 border border-border bg-background"
    >
      <input type="hidden" name="section" value={section} />

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b-2 border-b-[var(--rule-strong)] bg-muted/40 px-4 py-3.5 lg:px-5">
        <div className="min-w-0">
          <h2 id={`${section}-title`} className="news-headline text-lg">
            {title}
          </h2>
          <p className="mt-0.5 max-w-prose text-[0.8125rem] text-muted-foreground">{blurb}</p>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${title}: ${href}`}
          className="flex shrink-0 items-center gap-1.5 border border-border bg-background px-2 py-1 font-mono text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {href}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      </div>

      {preview}

      <div className="flex flex-col gap-5 px-4 py-5 lg:px-5">
        {children}

        {formError && (
          <p role="alert" className="text-[0.8125rem] text-destructive">
            {formError}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md lg:px-5">
        <StatusLine status={status} />

        <Button
          type="submit"
          disabled={isPending}
          // 38px to sit on the same rhythm as the fields above it, but 14px
          // type: the house rule shrinks *secondary* chrome, and this is the
          // one thing on the panel that is not that.
          className="ml-auto h-[38px] px-5"
        >
          {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          Хадгалах
        </Button>
      </div>
    </form>
  );
}
