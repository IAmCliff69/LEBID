import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";

import { getUnreadCount } from "@/api/notifications";

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch once on mount
    getUnreadCount()
      .then(setCount)
      .catch(() => setCount(0));

    // Poll every 60 seconds while the app is open
    const interval = setInterval(() => {
      getUnreadCount()
        .then(setCount)
        .catch(() => {});
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return (
    <button
      type="button"
      onClick={() => navigate("/notifications")}
      aria-label={
        count > 0
          ? `${count} unread notification${count === 1 ? "" : "s"}`
          : "Notifications"
      }
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Bell className="h-5 w-5" />

      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}