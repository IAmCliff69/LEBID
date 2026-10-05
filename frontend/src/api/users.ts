import apiClient from "./client";
import type { User } from "./auth";

// =========================================================
// TYPES
// =========================================================

export interface UpdateProfileData {
  full_name?: string;
  university?: string;
  programme?: string;
  level?: string;
  semester?: string;
  academic_year?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
}

// =========================================================
// PROFILE
// =========================================================

export const updateProfile = async (
  data: UpdateProfileData
): Promise<User> => {
  const response = await apiClient.patch(
    "/users/me",
    data
  );

  return response.data;
};

// =========================================================
// PASSWORD
// =========================================================

export const changePassword = async (
  data: ChangePasswordData
): Promise<MessageResponse> => {
  const response = await apiClient.patch(
    "/users/me/password",
    data
  );

  return response.data;
};

// =========================================================
// GEMINI API KEY
// =========================================================

export interface GeminiKeyResponse {
  message: string;
  has_gemini_api_key: boolean;
}

// Sends the student's own Gemini API key to the backend.
// The backend checks it with Google and only saves it if it works.
// The key is never returned by the API and never stored in the browser.
export const saveGeminiKey = async (
  apiKey: string
): Promise<GeminiKeyResponse> => {
  const response = await apiClient.post("/users/me/gemini-key", {
    api_key: apiKey,
  });

  return response.data;
};

// =========================================================
// STUDY PREFERENCES
// =========================================================

export interface StudyPreferencesData {
  study_times: ("morning" | "afternoon" | "evening")[];
  study_days: number[]; // 0 = Monday ... 6 = Sunday
  session_length_minutes: number; // the LONGEST a single session may be
  break_preference: "short" | "long";
}

// Saves (or replaces) the student's study preferences on the server.
export const saveStudyPreferences = async (
  data: StudyPreferencesData
): Promise<StudyPreferencesData> => {
  const response = await apiClient.put("/users/me/study-preferences", data);

  return response.data;
};

// Marks the student's onboarding as finished (safe to call more than once).
export const completeOnboarding = async (): Promise<User> => {
  const response = await apiClient.post("/users/me/complete-onboarding");
  return response.data;
};