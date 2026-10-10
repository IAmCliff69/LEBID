import apiClient from "./client";

export type LectureStatus = "missed" | "cancelled" | "completed";

export interface LectureOccurrence {
  id: string;
  timetable_entry_id: string | null;
  occurrence_date: string; // "YYYY-MM-DD"
  status: LectureStatus;
  course_code: string | null;
  course_name: string;
  course_color: string | null;
  class_type: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  created_at: string;
}

export interface LectureOccurrenceFilters {
  status?: LectureStatus;
  timetable_entry_id?: string;
  limit?: number;
}

export const getLectureOccurrences = async (
  filters: LectureOccurrenceFilters = {}
): Promise<LectureOccurrence[]> => {
  const response = await apiClient.get("/lecture-occurrences", {
    params: filters,
  });
  return response.data;
};

// Mark one date of a weekly class as missed or cancelled
export const markLecture = async (data: {
  timetable_entry_id: string;
  occurrence_date: string;
  status: LectureStatus;
}): Promise<LectureOccurrence> => {
  const response = await apiClient.post("/lecture-occurrences", data);
  return response.data;
};

// Undo a mark
export const deleteLectureMark = async (id: string): Promise<void> => {
  await apiClient.delete(`/lecture-occurrences/${id}`);
};