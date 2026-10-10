// One place that knows which page shows which kind of item.
// Toasts and dashboard widgets call getItemPath() so they never
// have to hard-code page addresses.

export type ItemType =
  | "task"
  | "assignment"
  | "exam"
  | "event"
  | "study_session"
  | "lecture";

// "date" ("YYYY-MM-DD") is needed for study sessions and lectures, because
// the planner has to know which week to open.
export function getItemPath(
  type: ItemType,
  id: string | number,
  date?: string
): string {
  switch (type) {
    case "task":
      return `/tasks?highlight=${id}`;
    case "assignment":
      return `/assignments?highlight=${id}`;
    case "exam":
      return `/exams?highlight=${id}`;
    case "event":
      return `/events?highlight=${id}`;
    case "study_session":
      // The planner opens that week and flashes the session
      return date ? `/planner?date=${date}&highlight=${id}` : "/planner";
    case "lecture":
      // "id" is the timetable entry; the block in the planner is "entry-date"
      return date
        ? `/planner?date=${date}&highlight=${id}-${date}`
        : "/timetable";
  }
}