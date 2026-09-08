"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApply } from "@/components/apply-provider";

type ApplyButtonProps = React.ComponentProps<typeof Button> & {
  label?: string;
  showIcon?: boolean;
};

export function ApplyButton({
  label = "Apply now",
  showIcon = false,
  className,
  ...props
}: ApplyButtonProps) {
  const { open } = useApply();

  return (
    <Button
      type="button"
      onClick={open}
      className={cn(
        "group/apply relative isolate gap-2 overflow-hidden",
        className,
      )}
      {...props}
    >
      {/* Brandbook "кант" dissolve, swept across on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/apply:opacity-100 motion-reduce:transition-none"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      />
      {label}
      {showIcon ? (
        // No data-icon="inline-end" here: that attribute triggers the button's
        // has-data-[icon=inline-end]:pr-2 rule, which would override the right
        // half of our px-* and push the label off centre.
        <ArrowRight className="transition-transform duration-200 group-hover/apply:translate-x-0.5" />
      ) : null}
    </Button>
  );
}
