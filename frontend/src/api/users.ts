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