"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL, type FacetOption } from "@/lib/jobs/types";
import { selectedLabel } from "@/components/job-filter-state";

/**
 * An option nobody can reach: a reference row with no open posting behind it.
 * It stays in the list — the owner wants every company visible, and "0" is
 * the answer to "is anything open there?" — but choosing it could only ever
 * produce the empty state, so it is not a target.
 */
function isUnreachable(option: FacetOption, isSelected: boolean): boolean {
  return option.count === 0 && option.value !== ALL && !isSelected;
}

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
  const isDisabled = isUnreachable(option, isSelected);

  // The rail is narrow and some location names are long, so the label
  // truncates - `title` keeps the whole of it reachable.
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      tabIndex={isTabStop && !isDisabled ? 0 : -1}
      onClick={() => onSelect(option.value)}
      title={option.label}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.8125rem] transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isDisabled && "cursor-not-allowed text-muted-foreground/60",
        isSelected
          ? "bg-primary/10 font-medium text-foreground"
          : !isDisabled && "text-foreground/85 hover:bg-muted",
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

/** Long enough that a word is finished before the URL moves, short enough
    that the results feel tied to the typing. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `jobName`, the one filter the API searches on by text.
 *
 * The URL owns the value — the query goes back to `getRecruitmentOrderList` on
 * the server — so the box keeps a draft while it is being typed and hands it
 * over once the typing settles. A chip removal or "Цэвэрлэх" changes the URL,
 * and the box follows it back.
 */
export function JobSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);

  /**
   * `seen` is the last `value` this box was rendered with; `committed` is the
   * last text it pushed into the URL.
   *
   * Both are needed because a navigation is not instant. While `router.push`
   * is in flight the prop still holds the old text and the new one arrives a
   * render or two later — so the box reacts only when the prop actually moves
   * (`value !== seen`), and even then leaves the draft alone when what arrived
   * is its own push catching up (`value === committed`). Anything else is an
   * edit from elsewhere — a chip removal, "Цэвэрлэх", the back button — and
   * refills the box. Without the pair, every letter typed during a slow
   * navigation would be thrown away when it landed.
   */
  const [seen, setSeen] = React.useState(value);
  const [committed, setCommitted] = React.useState(value);

  // Reset while rendering, not in an effect, so a change from elsewhere never
  // paints the old text for a frame first.
  if (value !== seen) {
    setSeen(value);
    if (value !== committed) {
      setCommitted(value);
      setDraft(value);
    }
  }

  // Kept in a ref so a new handler identity (the parent re-renders on every
  // navigation) does not restart the timer and delay the search.
  const handler = React.useRef(onChange);
  React.useEffect(() => {
    handler.current = onChange;
  });

  /** Pushes `next` now. Recording it as committed retires the debounced push
      waiting behind it, so Enter and the clear button navigate exactly once. */
  function commitNow(next: string) {
    if (next === committed) return;
    setCommitted(next);
    handler.current(next);
  }

  React.useEffect(() => {
    // Compared trimmed: the URL never carries the padding, so a trailing
    // space must not look like a pending change and push forever.
    const next = draft.trim();
    if (next === committed) return;
    const timer = setTimeout(() => {
      setCommitted(next);
      handler.current(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, committed]);

  function clear() {
    setDraft("");
    commitNow("");
  }

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter is "I have finished typing" — don't make it wait out the debounce.
          if (event.key === "Enter") {
            event.preventDefault();
            commitNow(draft.trim());
          }
        }}
        placeholder="Албан тушаалаар хайх"
        aria-label="Албан тушаалаар хайх"
        className="h-[2.375rem] w-full rounded-full border border-border/70 bg-background pr-10 pl-9 text-[0.8125rem] transition-colors placeholder:text-muted-foreground hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      {draft !== "" && (
        <button
          type="button"
          onClick={clear}
          aria-label="Хайлтыг цэвэрлэх"
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
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
    // Options with no postings behind them are disabled, so they are skipped
    // rather than trapping the arrow keys on an unreachable row.
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'),
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
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:-outline-offset-2 lg:pl-10"
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
          <div className="px-3 pb-4 lg:pl-7">
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
