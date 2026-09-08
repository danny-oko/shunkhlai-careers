import { cn } from "@/lib/utils";

/**
 * Above-the-fold entrance animation. Deliberately CSS-only and server
 * rendered: hero content must never depend on a client observer to become
 * visible. Use <Reveal> instead for anything below the fold.
 */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("brand-rise", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
