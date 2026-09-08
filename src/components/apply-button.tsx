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
      className={cn("group/apply gap-2", className)}
      {...props}
    >
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
