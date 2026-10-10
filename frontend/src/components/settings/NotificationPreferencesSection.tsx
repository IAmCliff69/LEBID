import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/api/notifications";
import type { NotificationPreferences } from "@/api/notifications";
import { cn } from "@/lib/utils";

const OPTIONS: {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}[] = [
  {
    key: "deadline_reminders",
    title: "Deadline reminders",
    description: "Assignments due soon, and tasks that have become overdue.",
  },
  {
    key: "exam_reminders",
    title: "Exam reminders",
    description: "Exams coming up in the next two weeks.",
  },
  {
    key: "missed_session_alerts",
    title: "Missed study sessions",
    description: "When a planned study session passes without being done.",
  },
];

// An on/off switch. It is a real button with role="switch" so keyboard
// and screen-reader users can use it too.
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export default function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences"];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: getNotificationPreferences,
  });

  // Flip one switch: show the change straight away, save it, and
  // put the old value back if saving fails.
  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!data) return;
    const previous = data;
    const next = { ...data, [key]: !data[key] };

    queryClient.setQueryData(queryKey, next);
    try {
      await saveNotificationPreferences(next);
    } catch {
      queryClient.setQueryData(queryKey, previous);
      toast.error("Couldn't save that change", {
        description: "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading your notification settings...
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        We couldn&apos;t load your notification settings. Please refresh the
        page.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-input">
      {OPTIONS.map((option) => (
        <li
          key={option.key}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{option.title}</p>
            <p className="text-xs text-muted-foreground">
              {option.description}
            </p>
          </div>
          <Switch
            checked={data[option.key]}
            onChange={() => handleToggle(option.key)}
            label={option.title}
          />
        </li>
      ))}
    </ul>
  );
}