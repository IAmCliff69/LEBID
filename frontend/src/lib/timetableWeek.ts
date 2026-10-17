// Timetable days: 0 = Monday ... 6 = Sunday (the same numbers the backend uses)
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Today's position in the week: Monday = 0 ... Sunday = 6
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}