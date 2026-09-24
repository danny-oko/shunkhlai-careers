"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";

import type { ContentActionState } from "@/app/admin/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The furniture every section form on `/admin/content` is built from.
 *
 * Three forms, one look: a ruled heading, the fields, and a save button that
 * reports in place. They are separate `<form>`s rather than one form with
 * three panels so that saving the footer cannot fail on something typed in
 * the hero — each section is its own row in `site_content` and its own
 * all-or-nothing save.
 *
 * The controls here are secondary controls, and are sized as such: 38px tall,
 * 13px type, which is the size the newsroom's "image link" field already uses
 * and noticeably tighter than the shadcn defaults these wrap. A content desk
 * is a dense list of short strings; full-size inputs turn twenty of them into
 * a page of scrolling.
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
}) {
  const id = `content-${name.replace(/\./gu, "-")}`;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-[0.6875rem] tracking-[0.14em] uppercase">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(CONTROL, inputClassName)}
      />
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

/** The "remove this row" control, and the "add another" under a list. */
export function RowRemove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 aria-hidden />
    </Button>
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
 * A list of rows an admin can add to, edit and remove.
 *
 * The row's key is a counter and not its index: keyed by index, removing the
 * first of three slides makes React re-use the removed row's DOM for the one
 * that took its place, which shows up as the wrong text left in an input.
 */
export function useRows<T>(initial: T[]): {
  rows: Array<{ id: number; value: T }>;
  add: (value: T) => void;
  remove: (id: number) => void;
  update: (id: number, patch: Partial<T>) => void;
} {
  const nextId = React.useRef(initial.length);
  const [rows, setRows] = React.useState(() =>
    initial.map((value, index) => ({ id: index, value })),
  );

  return {
    rows,
    add: (value) => setRows((current) => [...current, { id: nextId.current++, value }]),
    remove: (id) => setRows((current) => current.filter((row) => row.id !== id)),
    update: (id, patch) =>
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, value: { ...row.value, ...patch } } : row)),
      ),
  };
}

/**
 * The form element itself: heading, the fields, and the save bar.
 *
 * `section` rides as a hidden field because all three forms post to the same
 * action — it is what tells the action which schema to parse against and
 * which row to write.
 */
export function SectionShell({
  section,
  title,
  blurb,
  stored,
  state,
  isPending,
  action,
  children,
}: {
  section: string;
  title: string;
  blurb: string;
  /** False while the section still shows the values it shipped with. */
  stored: boolean;
  state: ContentActionState;
  isPending: boolean;
  action: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  // The action is shared, so an outcome is only this form's when it says so.
  const mine = state.section === section;
  const formError = mine ? state.fieldErrors?.form : undefined;

  return (
    <form action={action} className="border-b border-border py-8 first:pt-0">
      <input type="hidden" name="section" value={section} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="news-headline text-xl">{title}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">{blurb}</p>
          {!stored && (
            /* Worth saying: the form is showing the fallback copy, so the
               first save is what moves this section into the database. */
            <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
              Хадгалаагүй - одоогоор кодод бичигдсэн эх хувилбар харагдаж байна.
            </p>
          )}
        </div>

        <Button type="submit" disabled={isPending} className={CONTROL}>
          {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          Хадгалах
        </Button>
      </div>

      {mine && state.message && (
        <p
          role="alert"
          className={cn(
            "mt-4 flex items-center gap-2 border px-4 py-2.5 text-[0.8125rem]",
            state.ok
              ? "border-border bg-muted/50"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {state.ok ? (
            <CheckCircle2 aria-hidden className="size-4 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
          )}
          {state.message}
        </p>
      )}

      {formError && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-destructive">
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </form>
  );
}
