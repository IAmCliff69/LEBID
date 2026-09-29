import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  UserRound,
} from "lucide-react";

import { createTimetableEntry } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";

import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS = [
  { label: "Monday", value: "0" },
  { label: "Tuesday", value: "1" },
  { label: "Wednesday", value: "2" },
  { label: "Thursday", value: "3" },
  { label: "Friday", value: "4" },
  { label: "Saturday", value: "5" },
  { label: "Sunday", value: "6" },
];

const CLASS_TYPES = [
  { label: "Lecture", value: "lecture" },
  { label: "Tutorial", value: "tutorial" },
  { label: "Lab", value: "lab" },
  { label: "Practical", value: "practical" },
  { label: "Other", value: "other" },
];

const schema = z
  .object({
    course_id: z.string().min(1, "Please select a course"),
    day: z.string().min(1, "Please select a day"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    venue: z.string().optional(),
    class_type: z.string().min(1, "Please select a class type"),
    lecturer: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.start_time || !data.end_time) {
        return true;
      }

      return data.end_time > data.start_time;
    },
    {
      message: "End time must be after start time",
      path: ["end_time"],
    }
  );

type FormData = z.infer<typeof schema>;

interface Props {
  onEntryAdded: (entry: TimetableEntry) => void;
}

export default function AddTimetableEntryDialog({
  onEntryAdded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => {
        setCoursesError(
          "Unable to load your courses. Please try again."
        );
      });
  }, []);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      class_type: "lecture",
    },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    try {
      const entry = await createTimetableEntry({
        course_id: data.course_id,
        day_of_week: parseInt(data.day),
        start_time: `${data.start_time}:00`,
        end_time: `${data.end_time}:00`,
        venue: data.venue || null,
        class_type: data.class_type,
        lecturer: data.lecturer || null,
      });

      onEntryAdded(entry);

      reset({
        class_type: "lecture",
      });

      setOpen(false);
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            detail?: unknown;
          };
        };
      };

      const detail = error.response?.data?.detail;

      if (typeof detail === "string") {
        setServerError(detail);
      } else if (Array.isArray(detail)) {
        setServerError(
          detail
            .map((item: { msg?: string }) => item.msg)
            .filter(Boolean)
            .join(", ")
        );
      } else {
        setServerError(
          "Failed to add class. Please check the details and try again."
        );
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setServerError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl shadow-sm">
          <Plus className="size-4" />
          Add Class
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>

          <DialogTitle className="text-xl tracking-tight">
            Add a class
          </DialogTitle>

          <DialogDescription>
            Add a class to your weekly timetable.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 space-y-5"
        >
          {/* Course */}

          <div className="space-y-1.5">
            <Label>Course</Label>

            <Controller
              name="course_id"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>

                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem
                        key={course.id}
                        value={String(course.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                course.color || "var(--primary)",
                            }}
                          />

                          <span>
                            {course.code} — {course.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {coursesError && (
              <p className="text-xs text-destructive">
                {coursesError}
              </p>
            )}

            {errors.course_id && (
              <p className="text-xs text-destructive">
                {errors.course_id.message}
              </p>
            )}
          </div>

          {/* Day */}

          <div className="space-y-1.5">
            <Label>Day</Label>

            <Controller
              name="day"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select a day" />
                  </SelectTrigger>

                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem
                        key={day.value}
                        value={day.value}
                      >
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {errors.day && (
              <p className="text-xs text-destructive">
                {errors.day.message}
              </p>
            )}
          </div>

          {/* Time */}

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock3 className="size-4" />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Class time
                </p>

                <p className="text-xs text-muted-foreground">
                  Set when the class starts and ends.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start_time">
                  Start time
                </Label>

                <Input
                  id="start_time"
                  type="time"
                  className="rounded-xl bg-background"
                  {...register("start_time")}
                />

                {errors.start_time && (
                  <p className="text-xs text-destructive">
                    {errors.start_time.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="end_time">
                  End time
                </Label>

                <Input
                  id="end_time"
                  type="time"
                  className="rounded-xl bg-background"
                  {...register("end_time")}
                />

                {errors.end_time && (
                  <p className="text-xs text-destructive">
                    {errors.end_time.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Class Type */}

          <div className="space-y-1.5">
            <Label>Class type</Label>

            <Controller
              name="class_type"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>

                  <SelectContent>
                    {CLASS_TYPES.map((type) => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {errors.class_type && (
              <p className="text-xs text-destructive">
                {errors.class_type.message}
              </p>
            )}
          </div>

          {/* Venue */}

          <div className="space-y-1.5">
            <Label
              htmlFor="venue"
              className="flex items-center gap-2"
            >
              <MapPin className="size-3.5 text-muted-foreground" />
              Venue

              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>

            <Input
              id="venue"
              placeholder="e.g. Room 204, Engineering Block"
              className="rounded-xl"
              {...register("venue")}
            />
          </div>

          {/* Lecturer */}

          <div className="space-y-1.5">
            <Label
              htmlFor="lecturer"
              className="flex items-center gap-2"
            >
              <UserRound className="size-3.5 text-muted-foreground" />
              Lecturer

              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>

            <Input
              id="lecturer"
              placeholder="e.g. Dr. Mensah"
              className="rounded-xl"
              {...register("lecturer")}
            />
          </div>

          {/* Server Error */}

          {serverError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm font-medium text-destructive">
                {serverError}
              </p>
            </div>
          )}

          {/* Actions */}

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={
                isSubmitting || courses.length === 0
              }
              className="rounded-xl"
            >
              {isSubmitting ? "Adding..." : "Add class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}