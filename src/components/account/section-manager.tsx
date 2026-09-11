"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api";
import type { DropdownOption, SectionEntry, SectionResource } from "@/lib/api";

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
  type: "text" | "number" | "date" | "textarea" | "select" | "yesno";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Loader for `select` fields; re-runs whenever a `deps` field changes. */
  load?: (values: Values) => Promise<DropdownOption[]>;
  deps?: string[];
  wide?: boolean;
};

export type Values = Record<string, unknown>;

function SelectField({
  field,
  values,
  value,
  onChange,
  id,
}: {
  field: FieldDef;
  values: Values;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const depKey = `${field.name}:${(field.deps ?? [])
    .map((name) => String(values[name] ?? ""))
    .join("|")}`;

  const [loaded, setLoaded] = React.useState<{ key: string; options: DropdownOption[] } | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;

    (field.load?.(values) ?? Promise.resolve<DropdownOption[]>([]))
      .then((options) => {
        if (!cancelled) setLoaded({ key: depKey, options });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(`[${field.name}] dropdown failed`, error);
        setLoaded({ key: depKey, options: [] });
      });

    return () => {
      cancelled = true;
    };
    // `values` is intentionally excluded: only the declared deps should reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  const options = loaded?.key === depKey ? loaded.options : [];
  const isLoading = loaded?.key !== depKey;

  return (
    <Select
      id={id}
      value={value}
      disabled={isLoading}
      aria-busy={isLoading}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{isLoading ? "Ачаалж байна…" : "— Сонгох —"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
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
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function set(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const missing = fields.find(
      (field) => field.required && String(values[field.name] ?? "").trim() === "",
    );
    if (missing) {
      setError(`«${missing.label}» талбарыг бөглөнө үү.`);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit(values);
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

          return (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={id}
              required={field.required}
              hint={field.hint}
              className={field.wide ? "sm:col-span-2" : undefined}
            >
              {field.type === "select" ? (
                <SelectField
                  id={id}
                  field={field}
                  values={values}
                  value={value}
                  onChange={(next) => set(field.name, next)}
                />
              ) : field.type === "yesno" ? (
                <Select
                  id={id}
                  value={value || "N"}
                  onChange={(event) => set(field.name, event.target.value)}
                >
                  <option value="N">Үгүй</option>
                  <option value="Y">Тийм</option>
                </Select>
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
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              )}
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
    const payload: Values = { entryid: 0, ...values };
    for (const field of fields) {
      if (field.type === "number" || field.type === "select") {
        const raw = payload[field.name];
        payload[field.name] = raw === "" || raw === undefined ? null : Number(raw);
      }
    }

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
          initial={
            editing === "new"
              ? { ...defaults, entryid: 0 }
              : { ...defaults, ...(editing as Values) }
          }
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
