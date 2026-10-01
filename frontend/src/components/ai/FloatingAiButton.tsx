import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

const BUTTON_SIZE = 52;

export default function FloatingAiButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAiOpen = location.pathname === "/ai";

  const [pos, setPos] = useState(() => ({
    right: 24,
    bottom: Math.max(8, window.innerHeight / 2 - BUTTON_SIZE / 2),
  }));

  const dragging = useRef(false);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, right: 0, bottom: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      dragging.current = true;
      dragStart.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        right: pos.right,
        bottom: pos.bottom,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.pointerX;
      const dy = e.clientY - dragStart.current.pointerY;
      setPos({
        right: Math.max(8, Math.min(window.innerWidth - BUTTON_SIZE - 8, dragStart.current.right - dx)),
        bottom: Math.max(8, Math.min(window.innerHeight - BUTTON_SIZE - 8, dragStart.current.bottom - dy)),
      });
    },
    []
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging.current) return;
      const dx = Math.abs(e.clientX - dragStart.current.pointerX);
      const dy = Math.abs(e.clientY - dragStart.current.pointerY);
      dragging.current = false;

      // Only navigate if it was a tap/click, not a drag
      if (dx < 5 && dy < 5) {
        if (isAiOpen) {
          navigate(-1);
        } else {
          navigate("/ai");
        }
      }
    },
    [isAiOpen, navigate]
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={isAiOpen ? "Close AI Assistant" : "Open AI Assistant"}
      title={isAiOpen ? "Close AI Assistant" : "Open AI Assistant"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-80 flex items-center justify-center rounded-full select-none touch-none transition-transform duration-150 active:scale-95"
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        right: pos.right,
        bottom: pos.bottom,
        backgroundColor: "var(--primary)",
        boxShadow: isAiOpen
          ? "0 8px 28px color-mix(in srgb, var(--primary) 35%, transparent)"
          : "0 8px 28px color-mix(in srgb, var(--primary) 35%, transparent), 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      {isAiOpen ? (
        <X className="h-5 w-5 text-white" />
      ) : (
        <Sparkles className="h-5 w-5 text-white" />
      )}
    </button>
  );
}