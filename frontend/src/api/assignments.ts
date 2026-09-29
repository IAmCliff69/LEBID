import apiClient from "./client";

export type AssignmentStatus = "not_started" | "in_progress" | "completed" | "overdue";
export type AssignmentPriority = "low" | "medium" | "high" | "urgent";

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  course_code: string | null;
  course_color: string | null;
  date_assigned: string | null;
  deadline: string | null;
  estimated_hours: number | null;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  notes: string | null;
  created_at: string;
}

export interface CreateAssignmentData {
  title: string;
  description?: string | null;
  course_id?: string | null;
  date_assigned?: string | null;
  deadline?: string | null;
  estimated_hours?: number | null;
  priority?: AssignmentPriority;
  notes?: string | null;
}

export const getAssignments = async (): Promise<Assignment[]> => {
  const response = await apiClient.get("/assignments");
  return response.data;
};

export const createAssignment = async (
  data: CreateAssignmentData
): Promise<Assignment> => {
  const response = await apiClient.post("/assignments", data);
  return response.data;
};

export const updateAssignment = async (
  id: string,
  data: Partial<CreateAssignmentData> & { status?: AssignmentStatus }
): Promise<Assignment> => {
  const response = await apiClient.patch(`/assignments/${id}`, data);
  return response.data;
};

export const deleteAssignment = async (id: string): Promise<void> => {
  await apiClient.delete(`/assignments/${id}`);
};