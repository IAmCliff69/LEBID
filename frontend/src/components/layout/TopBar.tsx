import { LogOut, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/80">
      {/* Page title */}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">
          {title}
        </h1>
      </div>

      {/* User area */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogOut className="size-4.5" />
        </button>

        <Link
          to="/profile"
          className="hidden items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:flex"
          title="Open profile"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-4" />
          </div>

          <div className="min-w-0">
            <p className="max-w-32 truncate text-sm font-medium">
              {user?.full_name ?? "Student"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Student
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}