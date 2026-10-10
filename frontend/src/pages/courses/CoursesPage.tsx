import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, GraduationCap, Plus, Trash2 } from "lucide-react";
import AddCourseDialog from "@/components/courses/AddCourseDialog";
import EditCourseDialog from "@/components/courses/EditCourseDialog";
import { getCourses, deleteCourse } from "@/api/courses";
import type { Course } from "@/api/courses";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [deletingId, setDeletingId] = useState<string | null>(null);
const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await getCourses();
        setCourses(data);
      } catch {
        setError(
          "Failed to load courses. Please refresh the page."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

    const handleCourseAdded = (course: Course) => {
    setCourses((prev) => [...prev, course]);
    toast.success("Course added", {
      description: `${course.name} is now in your courses.`,
    });
  };

  const handleCourseUpdated = (updatedCourse: Course) => {
    setCourses((prev) =>
      prev.map((course) =>
        course.id === updatedCourse.id
          ? updatedCourse
          : course
      )
    );
    toast.success("Course updated", {
      description: `${updatedCourse.name} was saved.`,
    });
  };

    // Step 1: the Delete button only opens the confirmation dialog.
  const handleDelete = (course: Course) => {
    setCourseToDelete(course);
  };

  // Step 2: runs when the student confirms in the dialog.
  const confirmDelete = async () => {
    if (!courseToDelete) return;
    const course = courseToDelete;

    setDeletingId(String(course.id));
    try {
      await deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      toast.success("Course deleted", {
        description: `${course.name} was removed.`,
      });
    } catch {
      toast.error("Couldn't delete the course", {
        description: "Please try again.",
      });
    } finally {
      setDeletingId(null);
      setCourseToDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Courses
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Manage the courses you're currently studying and
            keep your academic information organized.
          </p>
        </div>
        <ConfirmDialog
          open={courseToDelete !== null}
          title="Delete this course?"
          description={`"${courseToDelete?.name ?? ""}" will be deleted, and so will all timetable entries, tasks and assignments linked to it. This cannot be undone.`}
          confirmLabel="Delete course"
          isLoading={deletingId !== null}
          onConfirm={confirmDelete}
          onCancel={() => setCourseToDelete(null)}
        />
        <AddCourseDialog
          onCourseAdded={handleCourseAdded}
        />
      </section>

      {/* =====================================================
          COURSE COUNT
      ===================================================== */}
      {!isLoading &&
        !error &&
        courses.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4" />

            <span>
              {courses.length} course
              {courses.length !== 1 ? "s" : ""} added
            </span>
          </div>
        )}

      {/* =====================================================
          LOADING
      ===================================================== */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
      )}

      {/* =====================================================
          ERROR
      ===================================================== */}
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4">
          <p className="text-sm font-medium text-destructive">
            {error}
          </p>

          <p className="mt-1 text-xs text-destructive/80">
            Check your connection and try refreshing the page.
          </p>
        </div>
      )}

      {/* =====================================================
          EMPTY STATE
      ===================================================== */}
      {!isLoading &&
        !error &&
        courses.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="size-7" />
            </div>

            <h3 className="mt-4 text-base font-semibold">
              No courses yet
            </h3>

            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Add your first course to start building your
              academic workspace.
            </p>

            <div className="mt-5 flex items-center gap-2 text-xs font-medium text-primary">
              <Plus className="size-3.5" />
              Use the Add Course button above
            </div>
          </div>
        )}

      {/* =====================================================
          COURSE CARDS
      ===================================================== */}
      {!isLoading &&
        !error &&
        courses.length > 0 && (
          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const courseColor =
                  course.color || "var(--primary)";

                return (
                  <div
                    key={course.id}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* Course colour strip */}
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{
                        backgroundColor: courseColor,
                      }}
                    />

                    <div className="flex items-start justify-between gap-4 pt-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: courseColor,
                            }}
                          />

                          <p
                            className="text-xs font-bold uppercase tracking-[0.12em]"
                            style={{
                              color: courseColor,
                            }}
                          >
                            {course.code}
                          </p>
                        </div>

                        <h3 className="mt-2 text-base font-semibold tracking-tight">
                          {course.name}
                        </h3>
                      </div>

                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <BookOpen className="size-4" />
                      </div>
                    </div>

                    {/* Bottom information + edit */}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                      {course.credit_hours ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Credits
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {course.credit_hours}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Course
                          </p>
                          <p className="text-sm font-medium">
                            Active
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <EditCourseDialog
                          course={course}
                          onCourseUpdated={handleCourseUpdated}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(course)}
                          disabled={deletingId === String(course.id)}
                          className="gap-2 rounded-xl text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          {deletingId === String(course.id) ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
    </div>
  );
}
