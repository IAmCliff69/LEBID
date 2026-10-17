import { useState } from "react";
import { CalendarDays, Clock, MapPin, NotebookText } from "lucide-react";

import type { Course } from "@/api/courses";
import type { StudySession } from "@/api/studySessions";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import BottomSheet from "@/components/mobile/BottomSheet";
import {
  sessionHasEnded,
  sessionHasStarted,
  useStudySessionActions,
} from "@/hooks/useStudySessionActions";
import { formatDateLabel, formatTimeLabel } from "@/lib/dateTime";

interface StudySessionSheetProps {
  session: StudySession | null;
  course: Course | undefined;
  now: Date;
  onClose: () => void;
  onEdit: (session: StudySession) => void;
  onReschedule: (session: StudySession) => void;
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  rescheduled: "Rescheduled",
};

const buttonBase =
  "flex h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50";

// Details of one study session, with every action the desktop planner has.
export default function StudySessionSheet({
  session,
  course,
  now,
  onClose,
  onEdit,
  onReschedule,
}: StudySessionSheetProps) {
  const { setStatus, remove } = useStudySessionActions();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onClose();
  };

  const started = session ? sessionHasStarted(session, now) : false;
  const missed = session
    ? session.status === "planned" && sessionHasEnded(session, now)
    : false;
  const finished = session?.status === "completed" || session?.status === "skipped";

  return (
    <>
      <BottomSheet
        open={session !== null}
        onOpenChange={(open) => !open && onClose()}
        title="Study session"
      >
        {session && (
          <div className="space-y-4">
            <div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
                {missed ? "Missed" : (STATUS_LABELS[session.status] ?? session.status)}
              </span>
              <h2 className="mt-2 text-lg leading-snug font-bold">
                {course
                  ? [course.code, course.name].filter(Boolean).join(" – ")
                  : "Study session"}
              </h2>
              {session.topic && (
                <p className="mt-0.5 text-sm text-muted-foreground">{session.topic}</p>
              )}
            </div>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2.5">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                {formatDateLabel(session.session_date)}
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="size-4 text-primary" aria-hidden="true" />
                {formatTimeLabel(session.start_time)} – {formatTimeLabel(session.end_time)}
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {session.venue}
              </li>
              {session.notes && (
                <li className="flex items-start gap-2.5">
                  <NotebookText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground">{session.notes}</span>
                </li>
              )}
            </ul>

            {/* Complete / Skip, or Undo */}
            <div className="flex gap-2">
              {finished ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => setStatus(session, "planned"))}
                  className={`${buttonBase} bg-muted`}
                >
                  Undo
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy || !started}
                    onClick={() => run(() => setStatus(session, "completed"))}
                    className={`${buttonBase} bg-success text-white`}
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setStatus(session, "skipped"))}
                    className={`${buttonBase} bg-muted`}
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
            {!finished && !started && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Complete is available once the session starts.
              </p>
            )}

            {missed && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReschedule(session);
                }}
                className={`${buttonBase} w-full bg-primary text-primary-foreground`}
              >
                Reschedule
              </button>
            )}

            <div className="flex gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={session.is_edit_locked}
                onClick={() => {
                  onClose();
                  onEdit(session);
                }}
                className={`${buttonBase} border border-border`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={`${buttonBase} border border-destructive/40 text-destructive`}
              >
                Delete
              </button>
            </div>
            {session.is_edit_locked && (
              <p className="-mt-2 text-xs text-muted-foreground">
                A session can't be edited once more than 24 hours have passed since it ended.
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this study session?"
        description="This can't be undone."
        confirmLabel="Delete"
        isLoading={busy}
        onConfirm={() => {
          if (!session) return;
          setConfirmDelete(false);
          void run(() => remove(session));
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}