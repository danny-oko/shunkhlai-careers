"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { controlPanelClass, controlTriggerClass } from "@/lib/controls/control-styles";
import { fromItemValue, labelFor, parseOptions, toItemValue } from "@/lib/controls/select-options";

type SelectProps = {
  value: string;
  /** Called with the chosen value; "" when the placeholder option is chosen. */
  onValueChange: (value: string) => void;
  /** `<option value>` children. The option with value "" is the placeholder. */
  children: React.ReactNode;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-busy"?: React.AriaAttributes["aria-busy"];
  "aria-describedby"?: string;
};

/**
 * The site's one dropdown: a Radix listbox that takes `<option>` children, so
 * a call site reads like the native control it replaced. The trigger takes the
 * `id` a Field label points at, and shares its look with the DatePicker.
 */
export function Select({
  value,
  onValueChange,
  children,
  id,
  name,
  className,
  disabled,
  required,
  ...aria
}: SelectProps) {
  const { placeholder, items } = React.useMemo(() => parseOptions(children), [children]);
  const label = labelFor(items, value);
  const showPlaceholder = value === "" || label === "";

  return (
    <SelectPrimitive.Root
      value={toItemValue(value)}
      onValueChange={(next) => onValueChange(fromItemValue(next))}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select"
        data-placeholder={showPlaceholder ? "" : undefined}
        className={cn(controlTriggerClass, className)}
        {...aria}
      >
        {/* Rendered here rather than left to Radix, so an unmatched value (a
            list still loading) reads as the placeholder, not as blank. */}
        <SelectPrimitive.Value>
          <span className="truncate">{showPlaceholder ? (placeholder ?? "") : label}</span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className={cn(controlPanelClass, "min-w-(--radix-select-trigger-width)")}
        >
          <SelectPrimitive.Viewport className="max-h-[min(20rem,var(--radix-select-content-available-height))] p-1.5">
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                className={cn(
                  "relative flex min-h-10 w-full cursor-pointer items-center rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none",
                  "data-[highlighted]:bg-brand/10 data-[state=checked]:font-medium",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  item.value === toItemValue("") && "text-muted-foreground",
                )}
              >
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="text-brand absolute right-3 flex items-center">
                  <CheckIcon className="size-4" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
