import { UserRound } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-between px-6 shrink-0">
      {/* Page title */}
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight truncate">
          {title}
        </h1>
      </div>

      {/* User area */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-4" />
          </div>

          <div className="min-w-0">
            <p className="max-w-32 truncate text-sm font-medium">
              {user?.name ?? "Student"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Student
            </p>
          </div>
        </div>

      </div>
    </header>
  );
}