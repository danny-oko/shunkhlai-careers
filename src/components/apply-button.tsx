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
      className={cn("group/apply", className)}
      {...props}
    >
      {label}
      {showIcon ? (
        <ArrowRight
          data-icon="inline-end"
          className="transition-transform duration-200 group-hover/apply:translate-x-0.5"
        />
      ) : null}
    </Button>
  );
}
