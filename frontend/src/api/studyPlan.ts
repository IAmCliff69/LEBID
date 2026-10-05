import apiClient from "./client";

// =========================================================
// TYPES (these match what the backend returns)
// =========================================================

// A class the plan was built around.
export interface PlannedClass {
  day_of_week: number; // 0 = Monday ... 6 = Sunday
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  course_name: string;
  course_code: string | null;
  class_type: string;
  venue: string | null;
}

// One proposed study session. It has no venue yet (added in a later step).
export interface PlannedStudySession {
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  course_name: string;
  course_code: string | null;
  topic: string;
}

export interface GeneratedStudyPlan {
  summary: string;
  classes: PlannedClass[];
  sessions: PlannedStudySession[];
  warnings: string[];
}

// =========================================================
// API
// =========================================================

// Asks the backend to propose a study plan around the classes in the
// timetable import. Nothing is saved on the server by this call.
export const generateStudyPlan = async (
  importId: string
): Promise<GeneratedStudyPlan> => {
  const response = await apiClient.post("/study-plan/generate", {
    import_id: importId,
  });
  return response.data;
};

// The plan after the AI applied a change the student asked for in words.
export interface AdjustedStudyPlan {
  message: string; // the AI's short explanation
  sessions: PlannedStudySession[];
  changes: string[]; // what really changed
  warnings: string[]; // what could not be changed, and why
}

// Sends the student's request and the current study sessions. The backend
// checks every change, and nothing is saved on the server.
export const adjustStudyPlan = async (
  importId: string | null,
  instruction: string,
  sessions: PlannedStudySession[]
): Promise<AdjustedStudyPlan> => {
  const response = await apiClient.post("/study-plan/adjust", {
    import_id: importId,
    instruction,
    sessions,
  });
  return response.data;
};

// A study session in the final plan: a proposed session plus its venue.
export type ActivationSession = PlannedStudySession & { venue: string };

// What was saved when the plan was activated.
export interface ActivatedPlan {
  courses_created: number;
  courses_reused: number;
  timetable_entries_saved: number;
  study_sessions_created: number;
  weeks: number;
  message: string;
}

// Starts using the reviewed plan. Either everything is saved, or nothing is.
export const activateStudyPlan = async (
  importId: string,
  sessions: ActivationSession[]
): Promise<ActivatedPlan> => {
  const response = await apiClient.post("/study-plan/activate", {
    import_id: importId,
    sessions,
  });
  return response.data;
};