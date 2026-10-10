import apiClient from "./client";

// =========================================================
// TYPES
// =========================================================

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  university: string | null;
  programme: string | null;
  level: string | null;
  semester: string | null;
  academic_year: string | null;
  is_active: boolean;
  has_gemini_api_key?: boolean;
  onboarding_completed?: boolean;
  has_avatar?: boolean;
  avatar_updated_at?: string | null;
}

// =========================================================
// AUTH API
// =========================================================

// Register a new student account
export const register = async (
  data: RegisterData
): Promise<User> => {
  const response = await apiClient.post("/auth/register", {
    full_name: data.name,
    email: data.email,
    password: data.password,
  });

  return response.data;
};

// Log in
export const login = async (
  data: LoginData
): Promise<User> => {
  const response = await apiClient.post("/auth/login", data);

  return response.data;
};

// Log out
export const logout = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};

// Get currently logged-in user
export const getMe = async (): Promise<User> => {
  const response = await apiClient.get("/auth/me");

  return response.data;
};