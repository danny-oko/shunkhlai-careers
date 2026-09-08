import { cn } from "@/lib/utils";

/**
 * The brandbook "кант" - the orange-to-amber band that sits under the header
 * on every piece of Shunkhlai stationery, with the diagonal light streak the
 * brandbook's own page headers carry.
 */
export function GradientRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("relative h-[3px] w-full overflow-hidden", className)}
      style={{ backgroundImage: "var(--brand-gradient)" }}
    >
      <div className="brand-sweep absolute inset-y-0 left-0 w-1/4 bg-white/45" />
    </div>
  );
}
