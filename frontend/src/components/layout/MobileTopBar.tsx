import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

import NotificationBell from "@/components/notifications/NotificationBell";
import UserAvatar from "@/components/common/UserAvatar";

// The top bar of the phone layout: logo on the left, bell, settings and
// profile on the right. The page's own heading sits below it, in the page.
export default function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.75rem+env(safe-area-inset-top))] shrink-0 items-center justify-between bg-background/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/80">
      <Link
        to="/dashboard"
        aria-label="Lebid Dashboard"
        className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-[#f4ede4] dark:px-2 dark:py-0.5"
      >
        <img
          src="/lebid-wordmark.png"
          alt="Lebid"
          draggable={false}
          className="h-9 w-auto select-none"
        />
      </Link>

      <div className="flex items-center gap-1">
        <NotificationBell />

        <Link
          to="/settings"
          aria-label="Settings"
          title="Settings"
          className="flex h-11 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Settings className="size-4.5" />
        </Link>

        <Link
          to="/profile"
          aria-label="Open profile"
          title="Open profile"
          className="ml-1 rounded-full ring-2 ring-transparent transition hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <UserAvatar size="md" />
        </Link>
      </div>
    </header>
  );
}