import apiClient from "./client";

// --- Types ---

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
  id: number;
  name: string;
  email: string;
  university: string | null;
  programme: string | null;
  level: string | null;
  semester: string | null;
  academic_year: string | null;
  created_at: string;
}

// --- API functions ---

// Register a new student account
export const register = async (data: RegisterData): Promise<User> => {
  const response = await apiClient.post("/auth/register", data);
  return response.data;
};

// Log in and receive a session cookie from the backend
export const login = async (data: LoginData): Promise<User> => {
  const response = await apiClient.post("/auth/login", data);
  return response.data;
};

// Log out and clear the session
export const logout = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};

// Get the currently logged-in user's profile
export const getMe = async (): Promise<User> => {
  const response = await apiClient.get("/auth/me");
  return response.data;
};