"use client";

import * as React from "react";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** The value setter every section shares. */
export type Setter = (name: string, value: string) => void;

export type Values = Record<string, string | boolean>;

export type Choice = { value: string; label: string };

export const TextField = ({
  name,
  label,
  values,
  set,
  required,
  readOnly,
  type,
  hint,
}: {
  name: string;
  label: string;
  values: Values;
  set: Setter;
  required?: boolean;
  readOnly?: boolean;
  type?: string;
  hint?: string;
}) => (
  <Field label={label} htmlFor={name} required={required} hint={hint}>
    <Input
      id={name}
      type={type}
      value={String(values[name])}
      readOnly={readOnly}
      className="read-only:bg-muted/50"
      onChange={(event) => set(name, event.target.value)}
    />
  </Field>
);

/**
 * Inside a form, Radix keeps a hidden native `<select>` and re-syncs it after
 * every `value` change, firing `change`. When the new value's option is not in
 * that native list yet — its list is still loading (the home-country seed can
 * land before GetCountryDropDown answers), or the option arrived in the same
 * render (a stored code outside the ERP's list) — the native select reads ""
 * and Radix reports "", which would wipe a value set in code. That echo only
 * comes in the commit where the value changed, so a "" then is ignored; a
 * choice the applicant makes always comes later.
 */
function useWithoutResetEcho(value: string, onChange: (next: string) => void) {
  const committed = React.useRef(value);
  const echo = React.useRef(false);
  React.useLayoutEffect(() => {
    echo.current = committed.current !== value;
    committed.current = value;
  }, [value]);
  // Passive effects run child-first: Radix's re-sync has already fired by now.
  React.useEffect(() => {
    echo.current = false;
  }, [value]);
  return (next: string) => {
    if (next === "" && echo.current) return;
    onChange(next);
  };
}

export const SelectField = ({
  name,
  label,
  values,
  set,
  options,
  required,
  disabled,
  isLoading,
}: {
  name: string;
  label: string;
  values: Values;
  set: Setter;
  options: Choice[];
  required?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}) => {
  const value = String(values[name]);
  const onValueChange = useWithoutResetEcho(value, (next) => set(name, next));
  return (
    <Field label={label} htmlFor={name} required={required}>
      <Select id={name} value={value} disabled={disabled || isLoading} onValueChange={onValueChange}>
        <option value="">{isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
};
