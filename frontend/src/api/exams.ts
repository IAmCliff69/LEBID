import apiClient from "./client";

export type ExamType =
  | "mid_semester"
  | "end_semester"
  | "quiz"
  | "test"
  | "practical"
  | "other";

export interface Exam {
  id: string;
  course_id: string;
  title: string;
  exam_type: ExamType;
  exam_date: string;       // "YYYY-MM-DD"
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  venue: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExamData {
  course_id: string;
  title: string;
  exam_type?: ExamType;
  exam_date: string;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  notes?: string | null;
}

export const getExams = async (): Promise<Exam[]> => {
  const response = await apiClient.get("/exams");
  return response.data;
};

export const getUpcomingExams = async (): Promise<Exam[]> => {
  const response = await apiClient.get("/exams/upcoming");
  return response.data;
};

export const createExam = async (data: CreateExamData): Promise<Exam> => {
  const response = await apiClient.post("/exams", data);
  return response.data;
};

export const updateExam = async (
  id: string,
  data: Partial<CreateExamData>
): Promise<Exam> => {
  const response = await apiClient.patch(`/exams/${id}`, data);
  return response.data;
};

export const deleteExam = async (id: string): Promise<void> => {
  await apiClient.delete(`/exams/${id}`);
};