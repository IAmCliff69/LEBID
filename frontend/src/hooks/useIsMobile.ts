import { useSyncExternalStore } from "react";

// Below this width (768px, Tailwind's "md") Lebid shows the phone layout.
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// true on a phone-sized screen, false otherwise. It updates by itself when the
// window is resized or the phone is rotated.
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}