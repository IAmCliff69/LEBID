import apiClient from "./client";

// --- Types ---

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type ClassType = "Lecture" | "Tutorial" | "Lab" | "Practical" | "Other";

export interface TimetableEntry {
  id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  course_color: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  class_type: string;
  lecturer: string | null;
}

export interface CreateTimetableEntryData {
  course_id: string | number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue?: string | null;
  class_type?: string;
  lecturer?: string | null;
}

// --- API functions ---

export const getTimetable = async (): Promise<TimetableEntry[]> => {
  const response = await apiClient.get("/timetable");
  return response.data;
};

export const createTimetableEntry = async (
  data: CreateTimetableEntryData
): Promise<TimetableEntry> => {
  const response = await apiClient.post("/timetable", data);
  return response.data;
};

export const updateTimetableEntry = async (
  id: number,
  data: Partial<CreateTimetableEntryData>
): Promise<TimetableEntry> => {
<<<<<<< HEAD
  const response = await apiClient.patch(`/timetable/${id}`, data);
=======
  const response = await apiClient.put(`/timetable/${id}`, data);
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
  return response.data;
};

export const deleteTimetableEntry = async (id: number): Promise<void> => {
  await apiClient.delete(`/timetable/${id}`);
};