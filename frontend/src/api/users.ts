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