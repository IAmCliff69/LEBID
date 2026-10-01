import { useState, useEffect, useCallback } from "react";
import { Bell, RefreshCw, CheckCheck, Trash2 } from "lucide-react";

import {
  getNotifications,
  generateNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/api/notifications";
import type { AppNotification } from "@/api/notifications";

import { Button } from "@/components/ui/button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  deadline_urgent: {
    label: "Urgent deadline",
    color: "border-destructive/20 bg-destructive/10",
    dot: "bg-destructive",
  },
  deadline: {
    label: "Upcoming deadline",
    color: "border-warning/20 bg-warning/10",
    dot: "bg-warning",
  },
  exam_urgent: {
    label: "Exam soon",
    color: "border-destructive/20 bg-destructive/10",
    dot: "bg-destructive",
  },
  exam_upcoming: {
    label: "Upcoming exam",
    color: "border-primary/20 bg-primary/10",
    dot: "bg-primary",
  },
  missed_session: {
    label: "Missed session",
    color: "border-warning/20 bg-warning/10",
    dot: "bg-warning",
  },
  overdue_task: {
    label: "Overdue task",
    color: "border-destructive/20 bg-destructive/10",
    dot: "bg-destructive",
  },
};

const DEFAULT_CONFIG = {
  label: "Notification",
  color: "border-border bg-muted",
  dot: "bg-muted-foreground",
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const load = useCallback(
    async (unreadOnly = showUnreadOnly) => {
      try {
        const data = await getNotifications({ unread_only: unreadOnly });
        setNotifications(data);
      } catch {
        setError("Failed to load notifications.");
      }
    },
    [showUnreadOnly]
  );

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateMessage(null);
    setError(null);
    try {
      const result = await generateNotifications();
      setGenerateMessage(result.message);
      await load();
    } catch {
      setError("Failed to generate notifications.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkRead = async (n: AppNotification) => {
    if (n.is_read) return;
    try {
      const updated = await markAsRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x))
      );
    } catch {
      // silently ignore — the user can try again
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    } catch {
      setError("Failed to mark all as read.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((x) => x.id !== id));
    } catch {
      setError("Failed to delete notification.");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
    } catch {
      setError("Failed to clear notifications.");
    }
  };

  const handleFilterChange = async (unreadOnly: boolean) => {
    setShowUnreadOnly(unreadOnly);
    setIsLoading(true);
    try {
      const data = await getNotifications({ unread_only: unreadOnly });
      setNotifications(data);
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Stay on top of deadlines, exams, and missed sessions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="shrink-0 gap-2"
        >
          <RefreshCw
            className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`}
          />
          {isGenerating ? "Checking..." : "Check now"}
        </Button>
      </div>

      {/* Generate message */}
      {generateMessage && (
        <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          {generateMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Toolbar */}
      {!isLoading && notifications.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          {/* Filter tabs */}
          <div className="flex items-center rounded-full border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => handleFilterChange(false)}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                !showUnreadOnly
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange(true)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition ${
                showUnreadOnly
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-secondary-foreground transition hover:bg-muted"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">
          Loading notifications...
        </p>
      )}

      {/* Empty state */}
      {!isLoading && notifications.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Bell className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {showUnreadOnly ? "No unread notifications" : "No notifications"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click "Check now" to scan your schedule for anything that needs
            attention.
          </p>
        </div>
      )}

      {/* Notification list */}
      {!isLoading && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => {
            const config = getConfig(n.notification_type);
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 transition ${
                  n.is_read
                    ? "border-border bg-card opacity-70"
                    : config.color
                }`}
              >
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  <span
                    className={`block h-2 w-2 rounded-full transition ${
                      n.is_read ? "bg-muted-foreground/50" : config.dot
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          n.is_read ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </p>
                    </div>

                    {/* Time + type badge */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                      <span className="inline-block rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-slate-200">
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-3">
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n)}
                        className="text-[11px] font-medium text-primary transition hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(n.id)}
                      className="text-[11px] font-medium text-destructive transition hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}