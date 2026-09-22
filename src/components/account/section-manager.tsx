"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AsyncCombobox } from "@/components/account/async-combobox";
import { cascadeEdges, clearDependents } from "@/components/account/dependent-fields";
import { encodeSectionValues, type EmptyAs } from "@/components/account/section-payload";
import { initialValues } from "@/components/account/section-values";
import { useDropdown } from "@/components/account/use-dropdown";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api";
import type { DropdownOption, DropdownQuery, SectionEntry, SectionResource } from "@/lib/api";

/**
 * One component for every CV section.
 *
 * The API models education, languages, computer skills, experience and family
 * as the same resource, so the UI does too: a list, an inline add/edit form
 * built from a field description, and a delete. Adding a section is a config
 * object, not another screen.
 */

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select" | "combobox" | "yesno";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /**
   * Loader for `select` and `combobox` fields; re-runs whenever a `deps` field
   * changes. `query` carries what the applicant typed and, for a `combobox`,
   * the `ids` that label an already-saved value — so a combobox field must
   * point at one of the endpoints that take `ids`.
   */
  load?: (values: Values, query: DropdownQuery) => Promise<DropdownOption[]>;
  /** Fields whose value this list hangs off. */
  deps?: string[];
  /** The endpoint requires the parent: none chosen, nothing to offer. */
  depsRequired?: boolean;
  /**
   * What an empty `number` / `select` / `combobox` value is sent as: left out
   * (default) or `0`. Never `null` — the backend 400s on it for some columns.
   */
  emptyAs?: EmptyAs;
  /**
   * A `combobox` whose list may not have the answer: a switch under it trades
   * the list for a text input writing `name` (the id is then left empty — so
   * `emptyAs` decides what it is sent as). `required` is met by either.
   */
  freeText?: { name: string; toggle: string; placeholder?: string };
  wide?: boolean;
};

export type Values = Record<string, unknown>;

const isBlank = (value: unknown) => String(value ?? "").trim() === "";

/** Free-text fields that open typed: a saved row with the name and no id. */
function initialManual(fields: FieldDef[], initial: Values): Record<string, boolean> {
  const manual: Record<string, boolean> = {};
  for (const field of fields) {
    if (!field.freeText) continue;
    manual[field.name] = isBlank(initial[field.name]) && !isBlank(initial[field.freeText.name]);
  }
  return manual;
}

/** The parent values this field's list was, or would be, read under. */
function depKeyOf(field: FieldDef, values: Values): string {
  return (field.deps ?? []).map((name) => String(values[name] ?? "")).join("|");
}

/** `false` while a required parent is still unchosen. */
function isReady(field: FieldDef, values: Values): boolean {
  if (!field.depsRequired) return true;
  return (field.deps ?? []).every((name) => String(values[name] ?? "") !== "");
}

function SelectField({
  field,
  values,
  value,
  onChange,
  id,
  waitingFor,
}: {
  field: FieldDef;
  values: Values;
  value: string;
  onChange: (value: string) => void;
  id: string;
  waitingFor: string;
}) {
  const depKey = depKeyOf(field, values);
  const ready = isReady(field, values);

  // The same loader the standalone forms use, so a dependent list behaves the
  // same way whether it is described by a `FieldDef` or wired up by hand.
  // Keyed on the declared deps alone — the loader closes over every value in
  // the form, and reloading on each keystroke elsewhere is not what `deps`
  // asked for.
  const { options, isLoading } = useDropdown(
    () => field.load?.(values, {}) ?? Promise.resolve<DropdownOption[]>([]),
    [field.name, depKey],
    ready,
  );

  const placeholder = !ready
    ? `Эхлээд «${waitingFor}» сонгоно уу`
    : isLoading
      ? "Ачаалж байна…"
      : "- Сонгох -";

  return (
    <Select
      id={id}
      value={value}
      disabled={!ready || isLoading}
      aria-busy={isLoading}
      onValueChange={onChange}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

function ComboboxField({
  field,
  values,
  value,
  onChange,
  id,
  waitingFor,
}: {
  field: FieldDef;
  values: Values;
  value: string;
  onChange: (value: string) => void;
  id: string;
  waitingFor: string;
}) {
  const ready = isReady(field, values);

  return (
    <AsyncCombobox
      id={id}
      value={value}
      disabled={!ready}
      reloadKey={depKeyOf(field, values)}
      placeholder={ready ? "Бичиж хайх" : `Эхлээд «${waitingFor}» сонгоно уу`}
      load={(query) => field.load?.(values, query) ?? Promise.resolve([])}
      resolve={async (saved) => {
        const rows = await (field.load?.(values, { ids: [saved] }) ?? Promise.resolve([]));
        return rows.find((row) => row.value === saved) ?? null;
      }}
      onChange={(next) => onChange(next)}
    />
  );
}

function EntryForm({
  fields,
  initial,
  onCancel,
  onSubmit,
}: {
  fields: FieldDef[];
  initial: Values;
  onCancel: () => void;
  onSubmit: (values: Values) => Promise<void>;
}) {
  const [values, setValues] = React.useState<Values>(initial);
  const [manual, setManual] = React.useState(() => initialManual(fields, initial));
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const edges = React.useMemo(() => cascadeEdges(fields), [fields]);
  const labelOf = React.useCallback(
    (name: string) => fields.find((field) => field.name === name)?.label ?? name,
    [fields],
  );

  function set(name: string, value: unknown) {
    setValues((current) => clearDependents({ ...current, [name]: value }, name, edges));
  }

  /** List ⇄ typed: the side switched away from is emptied, so only one is sent. */
  function setTyped(field: FieldDef, typed: boolean) {
    setManual((current) => ({ ...current, [field.name]: typed }));
    if (typed) set(field.name, "");
    else set(field.freeText!.name, "");
  }

  /** What the field holds: the typed name in typed mode, else its value. */
  const answerOf = (field: FieldDef) =>
    field.freeText && manual[field.name] ? values[field.freeText.name] : values[field.name];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const missing = fields.find((field) => field.required && isBlank(answerOf(field)));
    if (missing) {
      setError(`«${missing.label}» талбарыг бөглөнө үү.`);
      return;
    }

    // A typed name only counts in typed mode; a picked id drops it.
    const sent = { ...values };
    for (const field of fields) {
      if (field.freeText && !manual[field.name]) sent[field.freeText.name] = "";
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit(sent);
    } catch (submitError) {
      setError(toApiError(submitError).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border/70 bg-muted/30 space-y-5 rounded-xl border p-5"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `field-${field.name}`;
          const raw = values[field.name];
          const value = raw === null || raw === undefined ? "" : String(raw);
          const typed = field.freeText && manual[field.name] ? field.freeText : null;

          return (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={typed ? `field-${typed.name}` : id}
              required={field.required}
              hint={typed ? undefined : field.hint}
              className={field.wide ? "sm:col-span-2" : undefined}
            >
              {typed ? (
                <Input
                  id={`field-${typed.name}`}
                  type="text"
                  placeholder={typed.placeholder}
                  value={String(values[typed.name] ?? "")}
                  onChange={(event) => set(typed.name, event.target.value)}
                />
              ) : field.type === "select" ? (
                <SelectField
                  id={id}
                  field={field}
                  values={values}
                  value={value}
                  waitingFor={labelOf(field.deps?.[0] ?? "")}
                  onChange={(next) => set(field.name, next)}
                />
              ) : field.type === "combobox" ? (
                <ComboboxField
                  id={id}
                  field={field}
                  values={values}
                  value={value}
                  waitingFor={labelOf(field.deps?.[0] ?? "")}
                  onChange={(next) => set(field.name, next)}
                />
              ) : field.type === "yesno" ? (
                <Select
                  id={id}
                  value={value || "N"}
                  onValueChange={(next) => set(field.name, next)}
                >
                  <option value="N">Үгүй</option>
                  <option value="Y">Тийм</option>
                </Select>
              ) : field.type === "date" ? (
                <DatePicker id={id} value={value} onChange={(next) => set(field.name, next)} />
              ) : field.type === "textarea" ? (
                <Textarea
                  id={id}
                  rows={3}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              ) : (
                <Input
                  id={id}
                  type={field.type === "number" ? "number" : "text"}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              )}
              {field.freeText ? (
                <label className="text-muted-foreground flex w-fit cursor-pointer items-center gap-2 text-xs">
                  <Switch
                    id={`${id}-manual`}
                    size="sm"
                    checked={!!manual[field.name]}
                    onCheckedChange={(checked) => setTyped(field, checked)}
                  />
                  {field.freeText.toggle}
                </label>
              ) : null}
            </Field>
          );
        })}
      </div>

      <FormMessage message={error} />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSaving} className="h-9 rounded-full px-5">
          {isSaving ? <Loader2 className="animate-spin" /> : null}
          Хадгалах
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-9 rounded-full px-5"
        >
          Болих
        </Button>
      </div>
    </form>
  );
}

export function SectionManager<TEntry extends SectionEntry>({
  title,
  description,
  resource,
  fields,
  defaults,
  payload: toPayload,
  primary,
  secondary,
  emptyText = "Одоогоор бичлэг алга.",
  addLabel = "Нэмэх",
}: {
  title: string;
  description?: string;
  resource: SectionResource<TEntry>;
  fields: FieldDef[];
  defaults: Values;
  /** Last word on the save body — for a column derived from the others. */
  payload?: (values: Values) => Values;
  primary: (row: TEntry) => string;
  secondary: (row: TEntry) => string;
  emptyText?: string;
  addLabel?: string;
}) {
  const [token, setToken] = React.useState(0);
  const [loaded, setLoaded] = React.useState<{ token: number; rows: TEntry[] } | null>(null);
  const [editing, setEditing] = React.useState<TEntry | "new" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    resource
      .list()
      .then((rows) => {
        if (cancelled) return;
        setLoaded({ token, rows });
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setLoaded({ token, rows: [] });
        setError(toApiError(loadError).message);
      });

    return () => {
      cancelled = true;
    };
  }, [resource, token]);

  const rows = loaded?.token === token ? loaded.rows : (loaded?.rows ?? []);
  const isLoading = loaded?.token !== token;

  /** Handlers call this after a write; effects never do. */
  const reload = React.useCallback(async () => {
    setToken((current) => current + 1);
  }, []);

  async function save(values: Values) {
    const encoded = encodeSectionValues(fields, values);
    const payload = toPayload ? toPayload(encoded) : encoded;

    await resource.save(payload as TEntry);
    setEditing(null);
    toast.success("Хадгаллаа");
    await reload();
  }

  async function remove(row: TEntry) {
    if (!window.confirm("Энэ бичлэгийг устгах уу?")) return;
    try {
      await resource.remove(Number(row.entryid));
      toast.success("Устгалаа");
      await reload();
    } catch (removeError) {
      toast.error(toApiError(removeError).message);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          ) : null}
        </div>
        {editing === null ? (
          <Button
            variant="outline"
            onClick={() => setEditing("new")}
            className="h-9 rounded-full px-4"
          >
            <Plus className="size-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>

      {editing !== null ? (
        <EntryForm
          fields={fields}
          // Defaults are for new rows only; see `initialValues`.
          initial={initialValues(fields, defaults, editing === "new" ? "new" : (editing as Values))}
          onCancel={() => setEditing(null)}
          onSubmit={save}
        />
      ) : null}

      <FormMessage message={error} />

      {isLoading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Ачаалж байна…
        </p>
      ) : rows.length === 0 ? (
        <p className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-5 py-8 text-center text-sm">
          {emptyText}
        </p>
      ) : (
        <ul className="border-border/70 divide-border/70 divide-y rounded-xl border">
          {rows.map((row) => (
            <li
              key={String(row.entryid)}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{primary(row)}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-sm">
                  {secondary(row)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Засах"
                  onClick={() => setEditing(row)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Устгах"
                  onClick={() => remove(row)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { X };
