import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

// For pages only logged-out people should see (the Auth page).
// If a valid session exists, go straight to the Dashboard.
export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}