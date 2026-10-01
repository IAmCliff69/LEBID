import { useState, useEffect } from "react";
import { GraduationCap } from "lucide-react";

import { getExams, deleteExam } from "@/api/exams";
import type { Exam } from "@/api/exams";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

import AddExamDialog from "@/components/exams/AddExamDialog";
import EditExamDialog from "@/components/exams/EditExamDialog";
import { Button } from "@/components/ui/button";

const EXAM_TYPE_LABELS: Record<string, string> = {
  mid_semester: "Mid-Semester",
  end_semester: "End of Semester",
  quiz: "Quiz",
  test: "Test",
  practical: "Practical",
  other: "Other",
};

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(dateStr + "T00:00:00");
  return Math.ceil(
    (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-card delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<
    string | null
  >(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examData, courseData] = await Promise.all([
          getExams(),
          getCourses(),
        ]);
        setExams(examData);
        setCourses(courseData);
      } catch {
        setError("Failed to load exams. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCourse = (courseId: string) =>
    courses.find((c) => String(c.id) === String(courseId));

  const handleExamAdded = (exam: Exam) => {
    setExams((prev) =>
      [...prev, exam].sort(
        (a, b) =>
          new Date(a.exam_date).getTime() -
          new Date(b.exam_date).getTime()
      )
    );
  };

  const handleExamUpdated = (updated: Exam) => {
    setExams((prev) =>
      prev
        .map((e) => (e.id === updated.id ? updated : e))
        .sort(
          (a, b) =>
            new Date(a.exam_date).getTime() -
            new Date(b.exam_date).getTime()
        )
    );
  };

  const handleDeleteConfirm = async (exam: Exam) => {
    setDeletingId(exam.id);
    setDeleteError(null);
    try {
      await deleteExam(exam.id);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
      setConfirmingDeleteId(null);
    } catch {
      setDeleteError("Failed to delete exam. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const upcoming = exams.filter((e) => daysUntil(e.exam_date) >= 0);
  const past = exams.filter((e) => daysUntil(e.exam_date) < 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exams</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your upcoming examinations.
          </p>
        </div>
        <AddExamDialog onExamAdded={handleExamAdded} />
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading exams...</p>
      )}

      {/* Page-level error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && exams.length === 0 && (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <GraduationCap className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No exams yet</p>
          <p className="text-muted-foreground text-xs mt-1">
            Add your first exam to keep track of your examinations.
          </p>
        </div>
      )}

      {/* Upcoming exams */}
      {!isLoading && upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Upcoming
          </p>
          {upcoming.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              course={getCourse(exam.course_id)}
              onUpdated={handleExamUpdated}
              isDeleting={deletingId === exam.id}
              isConfirmingDelete={confirmingDeleteId === exam.id}
              deleteError={
                confirmingDeleteId === exam.id ? deleteError : null
              }
              onDeleteRequest={() => {
                setConfirmingDeleteId(exam.id);
                setDeleteError(null);
              }}
              onDeleteConfirm={() => handleDeleteConfirm(exam)}
              onDeleteCancel={() => {
                setConfirmingDeleteId(null);
                setDeleteError(null);
              }}
            />
          ))}
        </div>
      )}

      {/* Past exams */}
      {!isLoading && past.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Past
          </p>
          {past.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              course={getCourse(exam.course_id)}
              onUpdated={handleExamUpdated}
              isPast
              isDeleting={deletingId === exam.id}
              isConfirmingDelete={confirmingDeleteId === exam.id}
              deleteError={
                confirmingDeleteId === exam.id ? deleteError : null
              }
              onDeleteRequest={() => {
                setConfirmingDeleteId(exam.id);
                setDeleteError(null);
              }}
              onDeleteConfirm={() => handleDeleteConfirm(exam)}
              onDeleteCancel={() => {
                setConfirmingDeleteId(null);
                setDeleteError(null);
              }}
            />
          ))}
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// ExamCard
// ---------------------------------------------------------------------------

interface ExamCardProps {
  exam: Exam;
  course: Course | undefined;
  onUpdated: (exam: Exam) => void;
  isPast?: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  deleteError: string | null;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function ExamCard({
  exam,
  course,
  onUpdated,
  isPast = false,
  isDeleting,
  isConfirmingDelete,
  deleteError,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: ExamCardProps) {
  const days = daysUntil(exam.exam_date);

  const urgencyColor =
    days <= 3
      ? "text-destructive bg-destructive/10 border-destructive/20"
      : days <= 7
        ? "text-warning bg-warning/10 border-warning/20"
        : "text-primary bg-primary/10 border-primary/20";

  return (
    <div
      className={`bg-card border border-border rounded-xl px-4 py-4 ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Date block */}
        <div className="shrink-0 text-center min-w-12">
          <p className="text-xs text-muted-foreground font-medium uppercase">
            {new Date(exam.exam_date + "T00:00:00").toLocaleDateString(
              "en-GB",
              { month: "short" }
            )}
          </p>
          <p className="text-2xl font-bold leading-tight">
            {new Date(exam.exam_date + "T00:00:00").getDate()}
          </p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{exam.title}</p>

              {/* Course name — now resolved from loaded courses */}
              {course && (
                <p className="text-xs font-medium text-primary mt-0.5">
                  {course.code} — {course.name}
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-0.5">
                {EXAM_TYPE_LABELS[exam.exam_type] ?? exam.exam_type}
              </p>
            </div>

            {!isPast && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${urgencyColor}`}
              >
                {days === 0
                  ? "Today"
                  : days === 1
                    ? "Tomorrow"
                    : `${days}d`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {exam.start_time && (
              <span className="text-xs text-muted-foreground">
                {formatTime(exam.start_time)}
                {exam.end_time ? ` – ${formatTime(exam.end_time)}` : ""}
              </span>
            )}
            {exam.venue && (
              <span className="text-xs text-muted-foreground">
                {exam.venue}
              </span>
            )}
          </div>

          {exam.notes && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {exam.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <EditExamDialog exam={exam} onExamUpdated={onUpdated} />

          {!isConfirmingDelete ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteRequest}
              className="gap-2 text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                Sure?
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={onDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Yes"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDeleteCancel}
                disabled={isDeleting}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Inline delete error */}
      {deleteError && (
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <p className="text-destructive text-xs">{deleteError}</p>
        </div>
      )}
    </div>
  );
}
