import apiClient from "./client";

export type StudySessionPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

export type StudySessionStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "skipped"
  | "rescheduled";

export interface StudySession {
  id: string;
  user_id: string;
  course_id: string;
  topic: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  priority: StudySessionPriority;
  status: StudySessionStatus;
  notes: string | null;
  rescheduled_from_id: string | null;
  is_ai_generated: boolean;
}

export interface CreateStudySessionData {
  course_id: string;
  topic?: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  priority?: StudySessionPriority;
  notes?: string | null;
  is_ai_generated?: boolean;
}

export interface UpdateStudySessionData {
  course_id?: string;
  topic?: string | null;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  priority?: StudySessionPriority;
  status?: StudySessionStatus;
  notes?: string | null;
}

export interface RescheduleStudySessionData {
  course_id: string;
  topic?: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  priority?: StudySessionPriority;
  notes?: string | null;
  is_ai_generated?: boolean;
}

export interface DeleteStudySessionResponse {
  message: string;
}

/**
 * Get study sessions.
 *
 * Optional filters:
 * - course_id
 * - status
 * - date_from
 * - date_to
 */
export const getStudySessions = async (params?: {
  course_id?: string;
  status?: StudySessionStatus;
  date_from?: string;
  date_to?: string;
}): Promise<StudySession[]> => {
  const response = await apiClient.get("/study-sessions", {
    params,
  });

  return response.data;
};

/**
 * Get today's study sessions.
 */
export const getTodayStudySessions = async (): Promise<
  StudySession[]
> => {
  const response = await apiClient.get("/study-sessions/today");

  return response.data;
};

/**
 * Get study sessions for the backend's current 7-day window.
 */
export const getWeekStudySessions = async (): Promise<
  StudySession[]
> => {
  const response = await apiClient.get("/study-sessions/week");

  return response.data;
};

/**
 * Get missed study sessions.
 */
export const getMissedStudySessions = async (): Promise<
  StudySession[]
> => {
  const response = await apiClient.get("/study-sessions/missed");

  return response.data;
};

/**
 * Get one study session.
 */
export const getStudySession = async (
  id: string
): Promise<StudySession> => {
  const response = await apiClient.get(`/study-sessions/${id}`);

  return response.data;
};

/**
 * Create a study session.
 */
export const createStudySession = async (
  data: CreateStudySessionData
): Promise<StudySession> => {
  const response = await apiClient.post(
    "/study-sessions",
    data
  );

  return response.data;
};

/**
 * Update a study session.
 */
export const updateStudySession = async (
  id: string,
  data: UpdateStudySessionData
): Promise<StudySession> => {
  const response = await apiClient.patch(
    `/study-sessions/${id}`,
    data
  );

  return response.data;
};

/**
 * Reschedule a study session.
 *
 * The backend creates a new session and marks the
 * original session as "rescheduled".
 */
export const rescheduleStudySession = async (
  id: string,
  data: RescheduleStudySessionData
): Promise<StudySession> => {
  const response = await apiClient.post(
    `/study-sessions/${id}/reschedule`,
    data
  );

  return response.data;
};

/**
 * Delete a study session.
 */
export const deleteStudySession = async (
  id: string
): Promise<DeleteStudySessionResponse> => {
  const response = await apiClient.delete(
    `/study-sessions/${id}`
  );

  return response.data;
};