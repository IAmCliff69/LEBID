import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  className: string; // colours of the strip that appears behind the row
  onTrigger: () => void;
}

interface SwipeRowProps {
  children: ReactNode;
  right?: SwipeAction; // what a swipe to the RIGHT does
  left?: SwipeAction; // what a swipe to the LEFT does
  className?: string;
}

const TRIGGER_DISTANCE = 88; // how far to drag before letting go counts
const MAX_DISTANCE = 140;

// Wraps a card so it can be swiped sideways. Swipe right and swipe left each
// run their own action. A short drag springs back without doing anything, and
// vertical scrolling still works normally.
export default function SwipeRow({ children, right, left, className }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const justDragged = useRef(false);

  const handleDown = (event: PointerEvent<HTMLDivElement>) => {
    gesture.current = { x: event.clientX, y: event.clientY, horizontal: null };
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const moveX = event.clientX - g.x;
    const moveY = event.clientY - g.y;

    // Decide once whether this is a sideways swipe or a normal scroll
    if (g.horizontal === null && (Math.abs(moveX) > 8 || Math.abs(moveY) > 8)) {
      g.horizontal = Math.abs(moveX) > Math.abs(moveY);
      if (g.horizontal) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
    }

    if (g.horizontal) {
      const min = left ? -MAX_DISTANCE : 0;
      const max = right ? MAX_DISTANCE : 0;
      setDx(Math.min(max, Math.max(min, moveX)));
    }
  };

  const handleUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.horizontal) {
      // Stop the tap that follows a drag from opening the card
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);

      if (dx >= TRIGGER_DISTANCE && right) right.onTrigger();
      if (dx <= -TRIGGER_DISTANCE && left) left.onTrigger();
    }
    setDragging(false);
    setDx(0);
  };

  const active = dx > 0 ? right : dx < 0 ? left : undefined;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* The coloured strip with its label, revealed behind the card */}
      {active && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 flex items-center gap-2 px-5 text-sm font-semibold",
            dx > 0 ? "justify-start" : "justify-end",
            active.className
          )}
        >
          {active.icon}
          {active.label}
        </div>
      )}

      <div
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onClickCapture={(event) => {
          if (justDragged.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className="relative touch-pan-y"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}