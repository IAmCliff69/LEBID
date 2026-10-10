import apiClient from "./client";

// --- Types ---

export interface Course {
  id: number;
  code: string;
  name: string;
  credit_hours: number | null;
  color: string;
  created_at: string;
}

export interface CreateCourseData {
  code: string;
  name: string;
  credit_hours?: number | null;
  color?: string;
}

// --- API functions ---

// Get all courses for the logged-in student
export const getCourses = async (): Promise<Course[]> => {
  const response = await apiClient.get("/courses");
  return response.data;
};

// Create a new course
export const createCourse = async (data: CreateCourseData): Promise<Course> => {
  const response = await apiClient.post("/courses", data);
  return response.data;
};

// Update an existing course
export const updateCourse = async (
  id: number,
  data: Partial<CreateCourseData>
): Promise<Course> => {
    const response = await apiClient.patch(`/courses/${id}`, data);
  return response.data;
};

// Delete a course
export const deleteCourse = async (id: number): Promise<void> => {
  await apiClient.delete(`/courses/${id}`);
};