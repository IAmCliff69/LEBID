import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

// The floating box the pickers open in. z-[120] keeps it above pop-ups.
function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  style,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        // A pop-up underneath switches off clicks on the rest of the page.
        // This tells the picker to accept clicks anyway.
        style={{ pointerEvents: "auto", ...style }}
        // Stops the pop-up from blocking mouse-wheel scrolling in the
        // hour/minute columns.
        onWheel={(event) => event.stopPropagation()}
        className={cn(
          "z-[120] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-2xl border border-input bg-card p-3 text-card-foreground shadow-xl outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// The button that looks like an input box and opens a picker.
const pickerTriggerClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-[2.625rem] w-full items-center justify-between gap-2 rounded-xl border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

export { Popover, PopoverTrigger, PopoverContent, pickerTriggerClass };