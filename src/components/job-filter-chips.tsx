"use client";

import { X } from "lucide-react";
import type { ActiveFilter, FilterKey } from "@/components/job-filter-state";

/** Removable chips, one per active filter; the caller supplies the handlers
    the sidebar already uses. */
export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: ActiveFilter[];
  onRemove: (key: FilterKey) => void;
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <ul
      aria-label="Идэвхтэй шүүлтүүрүүд"
      className="flex flex-wrap items-center gap-2 border-b border-border/70 px-6 py-3 sm:px-10"
    >
      {filters.map((filter) => (
        <li
          key={filter.key}
          className="flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-3 text-[0.8125rem] font-medium"
        >
          <span className="truncate" title={filter.label}>
            {filter.label}
          </span>
          <button
            type="button"
            onClick={() => onRemove(filter.key)}
            aria-label={`${filter.label} шүүлтүүрийг арилгах`}
            className="relative grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-primary/15 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </li>
      ))}
      {filters.length >= 2 && (
        <li>
          <button
            type="button"
            onClick={onClearAll}
            className="relative rounded-full px-2 py-1 text-[0.8125rem] font-medium text-primary underline-offset-4 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Бүгдийг цэвэрлэх
          </button>
        </li>
      )}
    </ul>
  );
}
