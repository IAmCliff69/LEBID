import apiClient from "./client";

<<<<<<< HEAD
// =========================================================
// TYPES
// =========================================================
=======
// --- Types ---
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e

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
<<<<<<< HEAD
  id: string;
  full_name: string;
=======
  id: number;
  name: string;
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
  email: string;
  university: string | null;
  programme: string | null;
  level: string | null;
  semester: string | null;
  academic_year: string | null;
<<<<<<< HEAD
  is_active: boolean;
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
=======
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
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
export const logout = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};

<<<<<<< HEAD
// Get currently logged-in user
export const getMe = async (): Promise<User> => {
  const response = await apiClient.get("/auth/me");

=======
// Get the currently logged-in user's profile
export const getMe = async (): Promise<User> => {
  const response = await apiClient.get("/auth/me");
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
  return response.data;
};