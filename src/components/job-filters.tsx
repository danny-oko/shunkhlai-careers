"use client";

import * as React from "react";

import { Select } from "@/components/ui/select";
import type { FacetOption } from "@/lib/jobs/types";

/**
 * One filter, as a dropdown.
 *
 * Every list here now comes from `getDropDownData` rather than from the rows
 * on the page, which means each one is as long as the tenant's configuration
 * — locations and salary bands run to a few dozen. The open pill rail that
 * preceded this grew the sidebar by the length of its longest list and pushed
 * the postings off the first screen; a dropdown holds all of it in one row of
 * chrome.
 *
 * Native `<select>` rather than a listbox, for the same reason the account
 * forms use it: it is faster to operate on a phone, and accessible for
 * nothing. Counts ride in the option text because that is all a native option
 * can carry. The two server-side lists arrive without them — the page only
 * holds the rows for the current selection, so there is no honest number.
 */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg text-[0.8125rem] md:text-[0.8125rem]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {typeof option.count === "number"
              ? `${option.label} (${option.count})`
              : option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
