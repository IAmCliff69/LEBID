export type PlannerKind =
  | "lecture"
  | "study_session"
  | "event"
  | "exam"
  | "assignment"
  | "task";

// The order of the toggles in the "Other Calendars" card
export const KIND_ORDER: PlannerKind[] = [
  "event",
  "lecture",
  "study_session",
  "exam",
  "assignment",
  "task",
];

export const KIND_LABELS: Record<PlannerKind, string> = {
  event: "Personal Events",
  lecture: "Lectures",
  study_session: "Study Sessions",
  exam: "Exams",
  assignment: "Assignments",
  task: "Tasks",
};

// Singular names for the small chip on a card
export const KIND_CHIPS: Record<PlannerKind, string> = {
  event: "EVENT",
  lecture: "LECTURE",
  study_session: "STUDY",
  exam: "EXAM",
  assignment: "ASSIGNMENT",
  task: "TASK",
};

export const KIND_COLORS: Record<PlannerKind, string> = {
  event: "#9a5b7a",
  lecture: "#5b7fb5",
  study_session: "#4f7a5a",
  exam: "#b94a48",
  assignment: "#c88732",
  task: "#8b7566",
};

// "#4f7a5a" -> "rgba(79,122,90,0.15)". Falls back to null for anything else.
export function hexToRgba(hex: string, alpha: number): string | null {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// A course colour if it is a real colour, otherwise the colour of the kind
export function accentFor(kind: PlannerKind, courseColor: string | null): string {
  if (courseColor && hexToRgba(courseColor, 1)) return courseColor;
  return KIND_COLORS[kind];
}