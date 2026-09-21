"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeLinkInput, safeImageSrc } from "@/lib/news/shared/rich-text";
import type { ImageAttrs } from "@/lib/news/shared/rich-text";

import { STRINGS } from "./strings";

/**
 * The two small forms the toolbar opens: a link and a picture.
 *
 * They sit inside the outer article `<form>`, so neither is a `<form>` itself
 * (forms do not nest) — Enter is caught on the inputs and applies the popover
 * rather than submitting the article, and Escape cancels. Addresses are
 * checked here with the same functions the sanitiser uses, so what the editor
 * accepts is what will be kept.
 */

const PANEL =
  "absolute top-full left-0 z-30 mt-1 flex w-[min(21rem,calc(100vw-2.5rem))] flex-col gap-3 border border-border bg-popover p-3 text-popover-foreground shadow-md";

function useFirstFocus() {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return ref;
}

function onKeys(apply: () => void, cancel: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };
}

export function LinkPopover({
  initial,
  onApply,
  onRemove,
  onCancel,
}: {
  initial: { href: string; target: "_blank" | null } | null;
  onApply(link: { href: string; target: "_blank" | null }): void;
  onRemove(): void;
  onCancel(): void;
}) {
  const s = STRINGS.linkPopover;
  const [value, setValue] = React.useState(initial?.href ?? "");
  const [newTab, setNewTab] = React.useState(initial?.target === "_blank");
  const [error, setError] = React.useState(false);
  const inputRef = useFirstFocus();

  const apply = () => {
    const href = normalizeLinkInput(value);
    if (!href) {
      setError(true);
      return;
    }
    onApply({ href, target: newTab ? "_blank" : null });
  };

  return (
    <div role="dialog" aria-label={s.title} className={PANEL} onKeyDown={onKeys(apply, onCancel)}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rich-link-href" className="text-[0.75rem]">
          {s.address}
        </Label>
        <Input
          id="rich-link-href"
          ref={inputRef}
          value={value}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={s.placeholder}
          aria-invalid={error || undefined}
          aria-describedby={error ? "rich-link-error" : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
        />
        {error && (
          <p id="rich-link-error" role="alert" className="text-[0.75rem] text-destructive">
            {s.invalid}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-[0.8125rem]">
        <input
          type="checkbox"
          checked={newTab}
          onChange={(event) => setNewTab(event.target.checked)}
          className="size-3.5 accent-[var(--paper-accent)]"
        />
        {s.newTab}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={apply}>
          {s.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {s.cancel}
        </Button>
        {initial && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onRemove}>
            {s.remove}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ImagePopover({
  initial,
  onApply,
  onRemove,
  onCancel,
}: {
  initial: ImageAttrs | null;
  onApply(attrs: ImageAttrs): void;
  onRemove(): void;
  onCancel(): void;
}) {
  const s = STRINGS.imagePopover;
  const [src, setSrc] = React.useState(initial?.src ?? "");
  const [alt, setAlt] = React.useState(initial?.alt ?? "");
  const [caption, setCaption] = React.useState(initial?.title ?? "");
  const [error, setError] = React.useState(false);
  const inputRef = useFirstFocus();

  const apply = () => {
    const safe = safeImageSrc(src);
    if (!safe) {
      setError(true);
      return;
    }
    onApply({
      src: safe,
      alt: alt.trim(),
      title: caption.trim() || null,
      width: initial?.width ?? null,
      height: initial?.height ?? null,
    });
  };

  return (
    <div
      role="dialog"
      aria-label={initial ? s.editTitle : s.title}
      className={PANEL}
      onKeyDown={onKeys(apply, onCancel)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rich-image-src" className="text-[0.75rem]">
          {s.address}
        </Label>
        <Input
          id="rich-image-src"
          ref={inputRef}
          value={src}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={s.addressPlaceholder}
          aria-invalid={error || undefined}
          aria-describedby={error ? "rich-image-error" : undefined}
          onChange={(event) => {
            setSrc(event.target.value);
            setError(false);
          }}
        />
        {error && (
          <p id="rich-image-error" role="alert" className="text-[0.75rem] text-destructive">
            {s.invalid}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rich-image-alt" className="text-[0.75rem]">
          {s.alt}
        </Label>
        <Input id="rich-image-alt" value={alt} onChange={(event) => setAlt(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rich-image-caption" className="text-[0.75rem]">
          {s.caption}
        </Label>
        <Input
          id="rich-image-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={apply}>
          {initial ? s.save : s.insert}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {s.cancel}
        </Button>
        {initial && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onRemove}>
            {s.remove}
          </Button>
        )}
      </div>
    </div>
  );
}
