import { parseDateString, toDateString } from "@/lib/dateTime";

export type PlannerMode = "day" | "week" | "month";

// "YYYY-MM-DD" -> Date at noon (noon avoids daylight-saving edge cases)
function toNoon(key: string): Date {
  const date = parseDateString(key) ?? new Date();
  date.setHours(12, 0, 0, 0);
  return date;
}

export function addDays(key: string, amount: number): string {
  const date = toNoon(key);
  date.setDate(date.getDate() + amount);
  return toDateString(date);
}

// The Monday of the week that contains this day
export function mondayOf(key: string): string {
  const date = toNoon(key);
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDays(key, -sinceMonday);
}

// The 7 days (Monday to Sunday) of the week that contains this day
export function weekKeys(key: string): string[] {
  const monday = mondayOf(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Every cell of the month grid: whole weeks, Monday first
export function monthGridKeys(key: string): string[] {
  const date = toNoon(key);
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const rows = Math.ceil((leading + daysInMonth) / 7);
  const start = mondayOf(toDateString(first));
  return Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
}

// Same day in another month (a 31st becomes the last day of a shorter month)
export function shiftMonth(key: string, amount: number): string {
  const date = toNoon(key);
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateString(target);
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}