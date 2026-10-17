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
  email_verified?: boolean;
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

// Confirm an email address using the secret from the emailed link
export const verifyEmail = async (token: string): Promise<void> => {
  await apiClient.post("/auth/verify-email", { token });
};

// Ask for a new verification email (the student must be logged in)
export const resendVerification = async (): Promise<string> => {
  const response = await apiClient.post("/auth/resend-verification");
  return response.data.message;
};

// Ask for a password reset email. The answer is always the same, whether or
// not the email has an account.
export const forgotPassword = async (email: string): Promise<string> => {
  const response = await apiClient.post("/auth/forgot-password", { email });
  return response.data.message;
};

// Choose a new password using the secret from the reset link
export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<string> => {
  const response = await apiClient.post("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return response.data.message;
};