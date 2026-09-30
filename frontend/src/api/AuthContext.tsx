import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getMe, logout as logoutApi } from "@/api/auth";
import type { User } from "@/api/auth";

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

  // When the app first loads, check if there's already an active session.
  // The backend will return the user's profile if the cookie is valid,
  // or a 401 if not. This lets us restore login state after a page refresh.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await getMe();
        setUser(currentUser);
      } catch {
        // No valid session — user is not logged in
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
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

// Custom hook — use this in any component to access auth state
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}