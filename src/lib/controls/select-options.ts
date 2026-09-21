import * as React from "react";

/**
 * Radix Select forbids an item whose value is "", but every form here uses ""
 * for "nothing chosen" and lets the applicant go back to it. The empty option
 * is carried as this sentinel inside the control and translated at the edge.
 */
export const EMPTY_ITEM = "__empty__";

export type SelectItem = { value: string; label: string; disabled?: boolean };

export type ParsedOptions = {
  /** Text of the `<option value="">`, shown when nothing is chosen. */
  placeholder: string | undefined;
  /** Every option, the empty one included (as `EMPTY_ITEM`), in order. */
  items: SelectItem[];
};

export const toItemValue = (value: string): string => (value === "" ? EMPTY_ITEM : value);
export const fromItemValue = (value: string): string => (value === EMPTY_ITEM ? "" : value);

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/**
 * Reads `<option value>` children (fragments and arrays included) into items.
 * An option with no `value` attribute uses its text, as a native one does.
 */
export function parseOptions(children: React.ReactNode): ParsedOptions {
  const items: SelectItem[] = [];
  let placeholder: string | undefined;

  const visit = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(child)) {
        return;
      }
      if (child.type === React.Fragment) {
        visit(child.props.children);
        return;
      }
      if (child.type !== "option") return;
      const label = textOf(child.props.children);
      const value = child.props.value === undefined ? label : String(child.props.value);
      if (value === "") placeholder = label;
      items.push({ value: toItemValue(value), label, disabled: child.props.disabled });
    });
  };
  visit(children);

  return { placeholder, items };
}

/** The label to show for the current form value, or "" when it has none. */
export function labelFor(items: SelectItem[], value: string): string {
  return items.find((item) => item.value === toItemValue(value))?.label ?? "";
}
