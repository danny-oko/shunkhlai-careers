import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One labelled field, with its error and its character count.
 *
 * The count only appears once the field is more than three-quarters full: a
 * counter on an empty field is a limit presented as a target, which is the
 * wrong instruction for a headline.
 */
export function FieldShell({
  id,
  label,
  hint,
  error,
  value,
  limit,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value?: string;
  limit?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const used = value?.length ?? 0;
  const showCount = Boolean(limit) && used > (limit ?? 0) * 0.75;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label
          id={`${id}-label`}
          htmlFor={id}
          className="text-[0.6875rem] tracking-[0.14em] uppercase"
        >
          {label}
        </Label>
        {showCount && (
          <span
            className={cn(
              "text-[0.625rem] tabular-nums",
              used > (limit ?? 0) ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {used}/{limit}
          </span>
        )}
      </div>

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-[0.8125rem] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
