import apiClient from "./client";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "not_started" | "in_progress" | "completed" | "overdue";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  course_id: number | null;
  course_code: string | null;
  course_color: string | null;
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_duration: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateTaskData {
  title: string;
  description?: string | null;
  course_id?: number | null;
  deadline?: string | null;
  priority?: TaskPriority;
  estimated_duration?: number | null;
  notes?: string | null;
}

export const getTasks = async (): Promise<Task[]> => {
  const response = await apiClient.get("/tasks");
  return response.data;
};

export const createTask = async (data: CreateTaskData): Promise<Task> => {
  const response = await apiClient.post("/tasks", data);
  return response.data;
};

export const updateTask = async (
  id: number,
  data: Partial<CreateTaskData> & { status?: TaskStatus }
): Promise<Task> => {
  const response = await apiClient.patch(`/tasks/${id}`, data);
  return response.data;
};
export const deleteTask = async (id: number): Promise<void> => {
  await apiClient.delete(`/tasks/${id}`);
};