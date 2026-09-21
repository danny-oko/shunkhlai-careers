"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { mn } from "date-fns/locale";
import { DayPicker, type ChevronProps } from "react-day-picker";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { controlPanelClass, controlTriggerClass } from "@/lib/controls/control-styles";
import {
  dateFromValue,
  formatDateDisplay,
  isWithinBounds,
  normalizeDateValue,
  todayValue,
  valueFromDate,
  yearRange,
} from "@/lib/controls/date-value";

type DatePickerProps = {
  /** `yyyy-mm-dd`, or "". A dotted `yyyy.mm.dd` is read too; onChange sends ISO. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  /** Inclusive bounds, `yyyy-mm-dd`. */
  min?: string;
  max?: string;
  placeholder?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
};

const Chevron = ({ orientation, className }: ChevronProps) => {
  const Icon =
    orientation === "left" ? ChevronLeftIcon : orientation === "right" ? ChevronRightIcon : ChevronDownIcon;
  return <Icon className={cn("size-4", className)} aria-hidden />;
};

const footerButton =
  "hover:bg-brand/10 focus-visible:ring-ring/50 h-9 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-40";

/**
 * The site's one date field. Same trigger as Select; the panel is a Mongolian,
 * Monday-first calendar with month/year dropdowns for jumping decades.
 */
export function DatePicker({
  value,
  onChange,
  id,
  name,
  className,
  disabled,
  min,
  max,
  placeholder = "Огноо сонгох",
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const iso = normalizeDateValue(value);
  const selected = dateFromValue(iso);
  const display = formatDateDisplay(value);
  const years = yearRange({ value: iso, min, max });
  const today = todayValue();

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        type="button"
        disabled={disabled}
        data-slot="date-picker"
        data-placeholder={display ? undefined : ""}
        className={cn(controlTriggerClass, className)}
        {...aria}
      >
        <span className="truncate">{display || placeholder}</span>
        <CalendarIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </PopoverPrimitive.Trigger>
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={cn(controlPanelClass, "w-auto outline-none")}
        >
          <DayPicker
            mode="single"
            locale={mn}
            weekStartsOn={1}
            captionLayout="dropdown"
            startMonth={new Date(years.from, 0)}
            endMonth={new Date(years.to, 11)}
            defaultMonth={selected ?? dateFromValue(today)}
            selected={selected}
            onSelect={(date) => date && commit(valueFromDate(date))}
            disabled={[
              ...(dateFromValue(min) ? [{ before: dateFromValue(min) as Date }] : []),
              ...(dateFromValue(max) ? [{ after: dateFromValue(max) as Date }] : []),
            ]}
            components={{ Chevron }}
            classNames={{
              root: "p-3",
              months: "relative",
              month: "space-y-2",
              month_caption: "flex h-9 items-center justify-center",
              dropdowns: "flex items-center gap-1",
              dropdown_root:
                "relative rounded-lg has-[select:focus-visible]:ring-ring/50 has-[select:focus-visible]:ring-[3px]",
              dropdown: "absolute inset-0 cursor-pointer opacity-0",
              caption_label:
                "hover:bg-brand/10 flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium select-none",
              nav: "pointer-events-none absolute inset-x-0 top-0 flex h-9 items-center justify-between",
              button_previous:
                "hover:bg-brand/10 focus-visible:ring-ring/50 pointer-events-auto flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px]",
              button_next:
                "hover:bg-brand/10 focus-visible:ring-ring/50 pointer-events-auto flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px]",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "text-muted-foreground w-10 text-center text-xs font-normal",
              week: "mt-1 flex",
              day: "size-10 p-0 text-center text-sm",
              day_button:
                "hover:bg-brand/10 focus-visible:ring-ring/50 size-10 rounded-lg outline-none focus-visible:ring-[3px] motion-reduce:transition-none",
              today: "[&>button]:ring-brand/60 [&>button]:font-semibold [&>button]:ring-1",
              selected:
                "[&>button]:bg-brand [&>button]:text-brand-foreground [&>button]:hover:bg-brand [&>button]:ring-0",
              outside: "[&>button]:text-muted-foreground/60",
              disabled: "[&>button]:pointer-events-none [&>button]:opacity-35",
              hidden: "invisible",
            }}
          />
          <div className="border-border flex items-center justify-between border-t p-2">
            <button
              type="button"
              className={cn(footerButton, "text-brand")}
              disabled={!isWithinBounds(today, min, max)}
              onClick={() => commit(today)}
            >
              Өнөөдөр
            </button>
            <button type="button" className={footerButton} disabled={!iso} onClick={() => commit("")}>
              Арилгах
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
