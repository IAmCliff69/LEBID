import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";

import { createExam } from "@/api/exams";
import type { Exam, ExamType } from "@/api/exams";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

const EXAM_TYPES: { label: string; value: ExamType }[] = [
  { label: "Mid-Semester", value: "mid_semester" },
  { label: "End of Semester", value: "end_semester" },
  { label: "Quiz", value: "quiz" },
  { label: "Test", value: "test" },
  { label: "Practical", value: "practical" },
  { label: "Other", value: "other" },
];

const schema = z.object({
  course_id: z.string().min(1, "Please select a course"),
  title: z.string().min(1, "Title is required"),
  exam_type: z.string().min(1, "Please select an exam type"),
  exam_date: z.string().min(1, "Date is required"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  venue: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onExamAdded: (exam: Exam) => void;
}

export default function AddExamDialog({ onExamAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    getCourses().then(setCourses).catch(console.error);
  }, []);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { exam_type: "other" },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const exam = await createExam({
        course_id: data.course_id,
        title: data.title,
        exam_type: data.exam_type as ExamType,
        exam_date: data.exam_date,
        start_time: data.start_time ? data.start_time + ":00" : null,
        end_time: data.end_time ? data.end_time + ":00" : null,
        venue: data.venue || null,
        notes: data.notes || null,
      });
      onExamAdded(exam);
      reset();
      setOpen(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else if (Array.isArray(detail)) {
        setServerError(detail.map((d: { msg?: string }) => d.msg).join(", "));
      } else {
        setServerError("Failed to add exam. Please try again.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Add Exam
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an exam</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Mid-Semester Examination"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>

          {/* Course */}
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Controller
              name="course_id"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.code} — {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.course_id && (
              <p className="text-destructive text-xs">{errors.course_id.message}</p>
            )}
          </div>

          {/* Exam type */}
          <div className="space-y-1.5">
            <Label>Exam type</Label>
            <Controller
              name="exam_type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="exam_date">Exam date</Label>
            <Input
              id="exam_date"
              type="date"
              {...register("exam_date")}
            />
            {errors.exam_date && (
              <p className="text-destructive text-xs">{errors.exam_date.message}</p>
            )}
          </div>

          {/* Start and end time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">
                Start time{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input id="start_time" type="time" {...register("start_time")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">
                End time{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input id="end_time" type="time" {...register("end_time")} />
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <Label htmlFor="venue">
              Venue{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="venue"
              placeholder="e.g. Examination Hall A"
              {...register("venue")}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              {...register("notes")}
            />
          </div>

          {/* Server error */}
          {serverError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <p className="text-destructive text-sm">{serverError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add exam"}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}