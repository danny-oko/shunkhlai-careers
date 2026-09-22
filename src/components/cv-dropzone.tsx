"use client";

import * as React from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_CV_EXTENSIONS, CV_LIMITS_TEXT } from "@/lib/apply-schema";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CvDropzoneProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

/**
 * Pick or drop one CV file. Checking it (type, size) is the caller's job
 * (`describeCvFileError`). Also off inside a disabled `<fieldset>` — the
 * identity gate's `IdentityLock` — which a drop would otherwise slip past.
 */
export function CvDropzone({
  file,
  onFileChange,
  disabled = false,
  invalid = false,
  describedBy,
}: CvDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // `:disabled` also matches an input disabled by an ancestor fieldset.
  const isOff = () => disabled || inputRef.current?.matches(":disabled") === true;

  const openFilePicker = () => {
    if (!isOff()) inputRef.current?.click();
  };

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isOff()) return;

    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileChange(dropped);
  }

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    // Cleared so picking the same file again (after a refused upload) fires again.
    event.target.value = "";
    if (picked) onFileChange(picked);
  }

  if (file) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-3",
          disabled && "opacity-50",
        )}
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onFileChange(null)}
          disabled={disabled}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-4" />
          <span className="sr-only">{`${file.name} файлыг хасах`}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      data-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onClick={openFilePicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFilePicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isOff()) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        // Moving onto a child (the icon, the text) is not leaving.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-foreground/25 hover:bg-muted/40",
        invalid && !isDragging && "border-destructive/60",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <UploadCloud
        className={cn(
          "size-5 transition-colors",
          isDragging ? "text-primary" : "text-muted-foreground",
        )}
      />
      <p className="text-sm font-medium">
        CV-гээ энд чирж оруулах эсвэл{" "}
        <span className="underline underline-offset-4">файл сонгох</span>
      </p>
      <p className="text-xs text-muted-foreground">{CV_LIMITS_TEXT}</p>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        accept={ACCEPTED_CV_EXTENSIONS.join(",")}
        onClick={(event) => event.stopPropagation()}
        onChange={handlePick}
      />
    </div>
  );
}
