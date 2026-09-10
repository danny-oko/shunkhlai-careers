"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterOption } from "@/lib/jobs/types";

function FilterPill({
  option,
  isSelected,
  onSelect,
}: {
  option: FilterOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={() => onSelect(option.value)}
      className={cn(
        "flex w-full items-center gap-2 rounded-full border px-4 py-2.5 text-left text-sm transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isSelected
          ? "border-transparent bg-foreground font-medium text-background"
          : "border-border/70 text-foreground hover:bg-muted",
      )}
    >
      {option.depth === 1 ? (
        <span
          aria-hidden
          className={cn(
            "select-none",
            isSelected ? "text-background/50" : "text-muted-foreground/60",
          )}
        >
          —
        </span>
      ) : null}
      <span className="truncate">{option.label}</span>
      <span
        className={cn(
          "ml-auto text-xs tabular-nums",
          isSelected ? "text-background/60" : "text-muted-foreground/70",
        )}
      >
        {option.count}
      </span>
    </button>
  );
}

export function FilterSection({
  title,
  options,
  value,
  onChange,
  defaultOpen = false,
}: {
  title: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const contentId = React.useId();

  return (
    <div className="border-b border-border/70">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:-outline-offset-2"
      >
        <span className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
          {title}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* 0fr -> 1fr animates the height without measuring it. */}
      <div
        id={contentId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            role="radiogroup"
            aria-label={title}
            className="flex flex-col gap-2 px-6 pb-6"
          >
            {options.map((option) => (
              <FilterPill
                key={option.value}
                option={option}
                isSelected={option.value === value}
                onSelect={onChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
