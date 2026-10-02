import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // While we're checking if a session exists, show a blank background.
  // (After the splash this almost never appears, but keeps the UI consistent.)
  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  // Not logged in — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in — render the page normally
  return <>{children}</>;
}