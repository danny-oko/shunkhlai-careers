/** One look for the Select and DatePicker triggers, so they never drift apart. */
export const controlTriggerClass = [
  "border-input bg-background text-foreground flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-base shadow-xs outline-none md:text-sm",
  "transition-[color,box-shadow,border-color] motion-reduce:transition-none",
  "data-[placeholder]:text-muted-foreground",
  "hover:border-brand/50 disabled:hover:border-input",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "data-[state=open]:border-ring data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px]",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/** The floating panel shared by the listbox and the calendar popover. */
export const controlPanelClass = [
  "bg-popover text-popover-foreground border-border z-[60] overflow-hidden rounded-xl border shadow-lg",
  "max-w-[calc(100vw-1rem)]",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
  "motion-reduce:animate-none! duration-150",
].join(" ");
