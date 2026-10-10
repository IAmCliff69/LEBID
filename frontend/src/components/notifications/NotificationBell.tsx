import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";

import {
  generateNotifications,
  getUnreadCount,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/api/notifications";

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let isRefreshing = false;

    const refreshNotifications = async () => {
      if (isRefreshing) return;
      isRefreshing = true;

      try {
        const result = await generateNotifications();
        if (result.created_count > 0) {
          window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
        }
        setCount(await getUnreadCount());
      } catch (error) {
        console.error("Failed to refresh notifications:", error);
      } finally {
        isRefreshing = false;
      }
    };

    void refreshNotifications();

    const interval = window.setInterval(() => {
      void refreshNotifications();
    }, 60_000);
    window.addEventListener("focus", refreshNotifications);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNotifications);
    };
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