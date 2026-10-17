import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

// A panel that slides up from the bottom of the screen (the phone version of a
// pop-up). Tap outside it, or press Escape, to close it.
export default function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40"
          style={{ animation: "sheet-fade 200ms ease-out" }}
        />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-card-foreground shadow-2xl outline-none"
          style={{ animation: "sheet-up 260ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30"
          />
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {description ?? title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}