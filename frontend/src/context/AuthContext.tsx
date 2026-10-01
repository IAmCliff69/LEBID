/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getMe, logout as logoutApi } from "@/api/auth";
import type { User } from "@/api/auth";
import { SESSION_EXPIRED_EVENT } from "@/api/client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for an existing session ONCE, when the app opens.
  // The HttpOnly cookie is sent automatically; if it is valid, /auth/me
  // returns the user, otherwise it fails and we treat them as logged out.
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const currentUser = await getMe();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // If any later API call gets a 401, the session is no longer valid.
  // Clearing the user makes ProtectedRoute redirect to /login (no reload).
  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}