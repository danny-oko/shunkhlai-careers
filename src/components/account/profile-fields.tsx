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
}) => (
  <Field label={label} htmlFor={name} required={required}>
    <Select
      id={name}
      value={String(values[name])}
      disabled={disabled || isLoading}
      onValueChange={(next) => set(name, next)}
    >
      <option value="">{isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  </Field>
);
