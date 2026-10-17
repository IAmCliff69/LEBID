import { joinDateTime, toDateString, toTimeString } from "@/lib/dateTime";

// Priority chip colours
export const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-secondary-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

// An item is overdue when its deadline has passed and it is not completed.
// (Works for tasks and assignments.)
export function isTaskOverdue(item: { deadline: string | null; status: string }): boolean {
  if (!item.deadline || item.status === "completed") return false;
  return new Date(item.deadline).getTime() < Date.now();
}

// 45 -> "45 min", 120 -> "2 h", 90 -> "1 h 30 min"
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// "Mon, 20 Oct · 2:30 PM" (the year is added only when it is not this year)
export function formatDue(deadline: string): string {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

// Nearest deadline first. Items with no deadline go last.
export function sortByDeadline<T extends { deadline: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

// The deadline from the server -> the "YYYY-MM-DDTHH:mm" the date picker uses
export function toPickerValue(deadline: string | null): string {
  if (!deadline) return "";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "";
  return joinDateTime(
    toDateString(date),
    toTimeString(date.getHours(), date.getMinutes())
  );
}