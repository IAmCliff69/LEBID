import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteStudySession, updateStudySession } from "@/api/studySessions";
import type { StudySession, StudySessionStatus } from "@/api/studySessions";

// True once the session's start time has passed. The server refuses to mark a
// session completed before it starts, so the phone follows the same rule.
export function sessionHasStarted(session: StudySession, now: Date): boolean {
  return new Date(`${session.session_date}T${session.start_time.slice(0, 8)}`) <= now;
}

export function sessionHasEnded(session: StudySession, now: Date): boolean {
  return new Date(`${session.session_date}T${session.end_time.slice(0, 8)}`) <= now;
}

function errorText(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

const MESSAGES: Partial<Record<StudySessionStatus, string>> = {
  completed: "Session marked as completed",
  skipped: "Session skipped",
  planned: "Session set back to planned",
};

// Complete, skip, undo and delete for study sessions, with the same toast
// messages and Undo button on every page that uses it.
export function useStudySessionActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["study-sessions"] });

  const setStatus = async (session: StudySession, status: StudySessionStatus) => {
    const previous = session.status;
    try {
      await updateStudySession(session.id, { status });
      await refresh();
      toast.success(MESSAGES[status] ?? "Session updated", {
        action:
          status === "planned"
            ? undefined
            : {
                label: "Undo",
                onClick: () => {
                  updateStudySession(session.id, { status: previous })
                    .then(refresh)
                    .catch(() => toast.error("Couldn't undo that change."));
                },
              },
      });
      return true;
    } catch (error) {
      toast.error(errorText(error, "Couldn't update the session. Please try again."));
      return false;
    }
  };

  const remove = async (session: StudySession) => {
    try {
      await deleteStudySession(session.id);
      await refresh();
      toast.success("Study session deleted");
      return true;
    } catch (error) {
      toast.error(errorText(error, "Couldn't delete the session. Please try again."));
      return false;
    }
  };

  return { setStatus, remove, refresh };
}