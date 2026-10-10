// Small helpers for the Lebid date/time pickers.
// Dates are stored as "YYYY-MM-DD", times as "HH:MM" (24-hour) and
// date+time as "YYYY-MM-DDTHH:mm", the same formats the browser inputs used,
// so the backend and the forms keep working unchanged.

const pad = (n: number) => String(n).padStart(2, "0");

/** Date object -> "2026-10-07" (uses the local date, not UTC) */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-07" -> Date (local midnight), or null if it isn't valid */
export function parseDateString(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-10-07" -> "Wed, Oct 7, 2026" */
export function formatDateLabel(value?: string | null): string {
  const date = parseDateString(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface TimeParts {
  hour: number; // 0-23
  minute: number; // 0-59
}

/** "14:30" or "14:30:00" -> { hour: 14, minute: 30 } */
export function parseTimeString(value?: string | null): TimeParts | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** (14, 30) -> "14:30" */
export function toTimeString(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/** "14:30" -> "2:30 PM" */
export function formatTimeLabel(value?: string | null): string {
  const time = parseTimeString(value);
  if (!time) return "";
  const period = time.hour >= 12 ? "PM" : "AM";
  const hour12 = time.hour % 12 || 12;
  return `${hour12}:${pad(time.minute)} ${period}`;
}

/** "2026-10-07T14:30" -> { date: "2026-10-07", time: "14:30" } */
export function splitDateTime(value?: string | null): {
  date: string;
  time: string;
} {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

/** ("2026-10-07", "14:30") -> "2026-10-07T14:30" */
export function joinDateTime(date: string, time: string): string {
  return `${date}T${time}`;
}

/** "2026-10-07T14:30" -> "Oct 7, 2026, 2:30 PM" */
export function formatDateTimeLabel(value?: string | null): string {
  const { date, time } = splitDateTime(value);
  const parsed = parseDateString(date);
  if (!parsed) return "";
  const dateLabel = parsed.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return time ? `${dateLabel}, ${formatTimeLabel(time)}` : dateLabel;
}