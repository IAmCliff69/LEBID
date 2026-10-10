import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "lebid_theme";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  // Fall back to the OS preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// The theme is kept in ONE place for the whole app, so every toggle
// (the floating moon button, the Settings page, ...) always agrees.
let currentTheme: Theme = readStoredTheme();
const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

applyTheme(currentTheme);

function setThemeEverywhere(theme: Theme) {
  currentTheme = theme;
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => currentTheme);

  const setTheme = (next: Theme) => setThemeEverywhere(next);
  const toggleTheme = () =>
    setThemeEverywhere(currentTheme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggleTheme };
}