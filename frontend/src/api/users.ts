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

// Gets the student's saved study preferences (null if none saved yet).
export const getStudyPreferences =
  async (): Promise<StudyPreferencesData | null> => {
    const response = await apiClient.get("/users/me/study-preferences");
    return response.data;
  };

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

// =========================================================
// PROFILE PHOTO (AVATAR)
// =========================================================

// Upload (or replace) the student's profile photo.
// The backend resizes it to a small square.
export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.put("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

// Download the student's own photo and return a link the <img> tag can use.
// "version" changes whenever the photo changes, so the browser never shows
// an old cached picture.
export const getAvatarUrl = async (
  version?: string | null
): Promise<string> => {
  const response = await apiClient.get("/users/me/avatar", {
    params: { v: version ?? undefined },
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
};