import { cn } from "@/lib/utils";

/**
 * Brandbook 1.14 - "График элемент-1".
 *
 * The Shunkhlai eagle is drawn from a composition of circular shapes
 * ("дугуй дүрсний нийлэмжээр үүссэн"), rendered there as soft overlapping
 * orange-to-amber fields. This is that construction reduced to ambient
 * light: three arcs that drift slowly and never resolve into the mark.
 */
export function ArcBloom({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div
        className="brand-drift-a absolute -top-[28%] left-[8%] size-[42rem] rounded-full opacity-[0.13] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--brand) 0%, transparent 68%)",
        }}
      />
      <div
        className="brand-drift-b absolute -top-[14%] right-[4%] size-[34rem] rounded-full opacity-[0.14] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--brand-2) 0%, transparent 68%)",
        }}
      />
      <div
        className="brand-drift-c absolute top-[24%] left-[38%] size-[26rem] rounded-full opacity-[0.10] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--brand-2) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
