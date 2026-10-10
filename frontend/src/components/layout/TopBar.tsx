import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import UserAvatar from "@/components/common/UserAvatar";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {


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

        <Link
          to="/settings"
          aria-label="Settings"
          title="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Settings className="size-4.5" />
        </Link>

                <Link
          to="/profile"
          aria-label="Open profile"
          title="Open profile"
          className="rounded-full ring-2 ring-transparent transition hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <UserAvatar size="md" />
        </Link>
      </div>
    </header>
  );
}