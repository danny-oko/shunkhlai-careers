"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DropdownOption, DropdownQuery } from "@/lib/api";

/**
 * A dropdown that asks the server what to show.
 *
 * The lists behind Албан тушаал and Сургууль are 1463 and 1069 rows. A plain
 * `Select` is the right control for the short reference lists — every choice
 * is one press away — but it has no way to narrow those,
 * so the whole table arrived on first paint and the applicant scrolled. Every
 * endpoint takes `search` for exactly this, and `ids` to name the rows it must
 * return regardless: without the second, a saved university could not be
 * labelled once the list stopped being loaded whole, and editing a saved row
 * showed an empty box.
 *
 * Nothing is fetched until the box is opened, and a keystroke is held for
 * `DEBOUNCE_MS` so a typed word is one request rather than one per letter.
 *
 * The markup is the ARIA combobox pattern by hand rather than a Radix
 * listbox: the primitives move focus into the popup, and a combobox has to
 * keep it in the input and point at the active row with
 * `aria-activedescendant` instead.
 */

const DEBOUNCE_MS = 250;

/** One reference, so "nothing loaded yet" does not look like a new list. */
const NO_OPTIONS: DropdownOption[] = [];

type LoadResult = { options: DropdownOption[]; error: string | null };

function useSearchResults(
  load: (query: DropdownQuery) => Promise<DropdownOption[]>,
  search: string,
  reloadKey: string,
  enabled: boolean,
) {
  // The loader is a fresh closure on every render of the form around it, so
  // the effect below is keyed on what actually changes the answer instead. The
  // newest closure is held in a ref, refreshed by an effect declared above the
  // fetch so that it has already run by the time the fetch does — which is what
  // lets the key stay that narrow without ever calling a stale loader.
  const latest = React.useRef(load);
  React.useEffect(() => {
    latest.current = load;
  });

  const key = enabled ? JSON.stringify([reloadKey, search]) : "";
  const [loaded, setLoaded] = React.useState<{ key: string; result: LoadResult } | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    latest
      .current({ search })
      .then((options) => {
        if (!cancelled) setLoaded({ key, result: { options, error: null } });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[combobox] search failed", error);
        setLoaded({ key, result: { options: [], error: "Жагсаалтыг ачаалж чадсангүй." } });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const fresh = loaded?.key === key;
  return {
    options: fresh ? loaded.result.options : NO_OPTIONS,
    error: fresh ? loaded.result.error : null,
    isLoading: enabled && !fresh,
  };
}

/**
 * The label for a value that is not in the loaded page.
 *
 * `resolve` is what asks for it by id. It is optional because three endpoints
 * — `getPosGroupDropdown`, `getPositionsDropdown`, `GetSourceDropDown` — take
 * `search` and nothing else, so there is no id to ask by; those fields are
 * only ever filled in the same session that opened them.
 */
function useResolvedLabel(
  resolve: ((value: string) => Promise<DropdownOption | null>) | undefined,
  value: string,
  reloadKey: string,
  known: string | null,
) {
  const latest = React.useRef(resolve);
  React.useEffect(() => {
    latest.current = resolve;
  });

  const key = value && !known && resolve ? JSON.stringify([reloadKey, value]) : "";
  const [loaded, setLoaded] = React.useState<{ key: string; label: string } | null>(null);

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;

    latest
      .current?.(value)
      .then((option) => {
        if (!cancelled) setLoaded({ key, label: option?.label ?? "" });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[combobox] value lookup failed", error);
        setLoaded({ key, label: "" });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (known) return known;
  return loaded?.key === key ? loaded.label : "";
}

export function AsyncCombobox({
  id,
  value,
  onChange,
  load,
  resolve,
  reloadKey = "",
  disabled = false,
  placeholder = "Бичиж хайх",
  emptyText = "Илэрц олдсонгүй.",
}: {
  id: string;
  value: string;
  onChange: (value: string, option: DropdownOption | null) => void;
  /** Reads one page of the list; `search` is what the applicant typed. */
  load: (query: DropdownQuery) => Promise<DropdownOption[]>;
  /** Reads one row by its id, for a value that was saved earlier. */
  resolve?: (value: string) => Promise<DropdownOption | null>;
  /** Changing this drops the loaded rows — the parent choice moved under them. */
  reloadKey?: string;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
}) {
  const listId = `${id}-listbox`;
  const [isOpen, setIsOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [picked, setPicked] = React.useState<DropdownOption | null>(null);

  const root = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  // Shadows `isOpen` for the handlers that move focus themselves. Refocusing
  // the input fires `onFocus` synchronously, before the state those handlers
  // just set has been applied, so `isOpen` still reads false there and the box
  // would re-seed itself from the choice it was in the middle of clearing.
  const opened = React.useRef(false);

  const { options, error, isLoading } = useSearchResults(load, search, reloadKey, isOpen);
  const label = useResolvedLabel(
    resolve,
    value,
    reloadKey,
    picked && picked.value === value ? picked.label : null,
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  // Both resets are adjustments during render rather than effects — React's
  // own answer for state that has to follow a prop, and what `profile-form`
  // already does when the applicant changes. An effect would paint one frame
  // pointing at a row that is no longer there.
  const [pickedUnder, setPickedUnder] = React.useState(reloadKey);
  if (pickedUnder !== reloadKey) {
    // A label chosen under a different parent is not this list's to show.
    setPickedUnder(reloadKey);
    setPicked(null);
  }

  const [activeWithin, setActiveWithin] = React.useState(options);
  if (activeWithin !== options) {
    setActiveWithin(options);
    // Open onto the current choice rather than the top of the list, so the
    // first ArrowDown steps off what is already selected.
    const selected = options.findIndex((option) => option.value === value);
    setActiveIndex(selected >= 0 ? selected : options.length > 0 ? 0 : -1);
  }

  // Arrow keys move a highlight, not the scroll position, so a list longer
  // than its box would otherwise leave the active row out of sight.
  React.useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    document
      .getElementById(`${id}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [id, isOpen, activeIndex]);

  const close = React.useCallback(() => {
    opened.current = false;
    setIsOpen(false);
    setTyped("");
    setSearch("");
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) close();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen, close]);

  /**
   * Opening keeps what is already chosen on screen and selects it.
   *
   * Blanking the box on focus is the editable-combobox mistake: a keyboard
   * user tabbing through a finished form watches every answer disappear, and
   * the list that opens is the unfiltered one rather than the one the current
   * choice came from. Seeding the query with the label instead means the list
   * opens around that choice, and because the text is selected the first
   * keystroke still replaces it.
   */
  function open() {
    if (disabled || opened.current) return;
    opened.current = true;
    setTyped(label);
    setSearch(label.trim());
    setIsOpen(true);
    requestAnimationFrame(() => input.current?.select());
  }

  function select(option: DropdownOption) {
    setPicked(option);
    onChange(option.value, option);
    close();
    input.current?.focus();
  }

  function clear() {
    setPicked(null);
    onChange("", null);
    setTyped("");
    setSearch("");
    // The button unmounts with the value it belonged to, so focus has to be
    // handed back or it falls to the document.
    opened.current = true;
    setIsOpen(true);
    input.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (isOpen) event.stopPropagation();
      close();
      return;
    }

    if (event.key === "Tab") {
      if (isOpen) close();
      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) return;
      event.preventDefault();
      const option = options[activeIndex];
      if (option) select(option);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
      return;
    }

    if (!isOpen) return;

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(options.length > 0 ? 0 : -1);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  }

  const activeId = activeIndex >= 0 && options[activeIndex] ? `${id}-option-${activeIndex}` : undefined;

  return (
    <div ref={root} className="relative">
      <Input
        ref={input}
        id={id}
        role="combobox"
        type="text"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-busy={isLoading}
        disabled={disabled}
        placeholder={disabled ? "" : placeholder}
        className="pr-16"
        value={isOpen ? typed : label}
        onChange={(event) => {
          setTyped(event.target.value);
          opened.current = true;
          setIsOpen(true);
        }}
        onFocus={open}
        onClick={open}
        onKeyDown={onKeyDown}
      />

      <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
        {value && !disabled ? (
          <button
            type="button"
            aria-label="Сонголтыг арилгах"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground rounded-sm p-1"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        {isLoading ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
        ) : (
          <ChevronDown className="text-muted-foreground size-4" aria-hidden />
        )}
      </div>

      {isOpen ? (
        <div className="border-border bg-popover text-popover-foreground absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-md border shadow-md">
          <ul id={listId} role="listbox" aria-label={placeholder} className="py-1">
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                onPointerDown={(event) => {
                  // Keep focus in the input; the blur would close the list
                  // before the click ever landed on the row.
                  event.preventDefault();
                  select(option);
                }}
                onPointerEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
              >
                <Check
                  className={cn("size-4 shrink-0", option.value === value ? "" : "invisible")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
              </li>
            ))}
          </ul>

          {options.length === 0 ? (
            <p className="text-muted-foreground px-3 py-3 text-sm" role="status">
              {isLoading ? "Ачаалж байна…" : (error ?? emptyText)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
