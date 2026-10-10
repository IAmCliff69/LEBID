import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

// For list pages (tasks, assignments, exams, events).
// If the page address contains ?highlight=<id>, scroll to that item once
// the list has loaded and flash it so the student sees which one it is.
//
// Each item card must have  data-item-id={item.id}  on its outer element.
export function useHighlightItem(isReady: boolean) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const itemId = searchParams.get("highlight");

  useEffect(() => {
    if (!itemId || !isReady) return;

    let timer: number | undefined;
    let element: HTMLElement | null = null;

    // Wait one frame so the cards are on the screen before we look for one.
    const frame = requestAnimationFrame(() => {
      element = document.querySelector<HTMLElement>(
        `[data-item-id="${CSS.escape(itemId)}"]`
      );
      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("lebid-highlight");
      timer = window.setTimeout(() => {
        element?.classList.remove("lebid-highlight");
      }, 2500);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      element?.classList.remove("lebid-highlight");
    };
    // location.key changes on every navigation, so opening the same link
    // twice still flashes the item twice.
  }, [itemId, isReady, location.key]);
}