"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL, type FacetOption } from "@/lib/jobs/types";
import { selectedLabel } from "@/components/job-filter-state";

function FilterOption({
  option,
  isSelected,
  isTabStop,
  onSelect,
}: {
  option: FacetOption;
  isSelected: boolean;
  isTabStop: boolean;
  onSelect: (value: string) => void;
}) {
  // The rail is narrow and some location names are long, so the label
  // truncates - `title` keeps the whole of it reachable.
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={isTabStop ? 0 : -1}
      onClick={() => onSelect(option.value)}
      title={option.label}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.8125rem] transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isSelected
          ? "bg-primary/10 font-medium text-foreground"
          : "text-foreground/85 hover:bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
          isSelected ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {isSelected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="truncate">{option.label}</span>
      {typeof option.count === "number" && (
        <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">
          {option.count}
        </span>
      )}
    </button>
  );
}

/** Long lists scroll; the fade at the foot disappears once the end is reached. */
function OptionList({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: FacetOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [atEnd, setAtEnd] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);

  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  }, []);
  React.useEffect(measure, [measure, options.length]);

  // Arrow keys move focus between options; selecting stays on space/enter so
  // browsing the location list does not fire a navigation per keypress.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const current = radios.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;
    event.preventDefault();
    let next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = radios.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = (current + 1) % radios.length;
    else next = (current - 1 + radios.length) % radios.length;
    radios[next]?.focus();
  }

  const hasSelected = options.some((option) => option.value === value);

  return (
    <div className="relative">
      <div
        ref={ref}
        role="radiogroup"
        aria-label={title}
        onKeyDown={onKeyDown}
        onScroll={measure}
        className="flex max-h-56 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {options.map((option, index) => (
          <FilterOption
            key={option.value}
            option={option}
            isSelected={option.value === value}
            isTabStop={hasSelected ? option.value === value : index === 0}
            onSelect={onChange}
          />
        ))}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent transition-opacity",
          atEnd ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
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
  options: FacetOption[];
  value: string;
  onChange: (value: string) => void;
  defaultOpen?: boolean;
}) {
  // A section holding an active filter starts open, so the choice is visible.
  const [isOpen, setIsOpen] = React.useState(
    defaultOpen || (value !== ALL && value !== ""),
  );
  const contentId = React.useId();
  const summary = selectedLabel(options, value);
  const isActive = value !== ALL && value !== "";

  return (
    <div className="border-b border-border/70">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:-outline-offset-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          {isActive && (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
          )}
          <span className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em]">
            {title}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {summary && !isOpen && (
            <span
              title={summary}
              className="max-w-[8rem] truncate rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {summary}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>

      {/* 0fr -> 1fr animates the height without measuring it. */}
      <div
        id={contentId}
        inert={!isOpen}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-4">
            <OptionList
              title={title}
              options={options}
              value={value}
              onChange={onChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
