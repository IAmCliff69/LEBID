import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";

import { updateExam } from "@/api/exams";
import type { Exam, ExamType } from "@/api/exams";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

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

// Strips seconds from "HH:MM:SS" → "HH:MM" for the time input
function toTimeInput(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

const schema = z.object({
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
  exam: Exam;
  onExamUpdated: (exam: Exam) => void;
}

export default function EditExamDialog({ exam, onExamUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: exam.title,
      exam_type: exam.exam_type,
      exam_date: exam.exam_date,
      start_time: toTimeInput(exam.start_time),
      end_time: toTimeInput(exam.end_time),
      venue: exam.venue || "",
      notes: exam.notes || "",
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reset({
        title: exam.title,
        exam_type: exam.exam_type,
        exam_date: exam.exam_date,
        start_time: toTimeInput(exam.start_time),
        end_time: toTimeInput(exam.end_time),
        venue: exam.venue || "",
        notes: exam.notes || "",
      });
      setServerError(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const updated = await updateExam(exam.id, {
        title: data.title,
        exam_type: data.exam_type as ExamType,
        exam_date: data.exam_date,
        start_time: data.start_time ? data.start_time + ":00" : null,
        end_time: data.end_time ? data.end_time + ":00" : null,
        venue: data.venue || null,
        notes: data.notes || null,
      });
      onExamUpdated(updated);
      setOpen(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else {
        setServerError("Failed to update exam. Please try again.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit exam</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" {...register("title")} />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Exam type</Label>
            <Controller
              name="exam_type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue />
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

          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Exam date</Label>
            <Controller
              name="exam_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="edit-date"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.exam_date}
                />
              )}
            />
            {errors.exam_date && (
              <p className="text-destructive text-xs">{errors.exam_date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Start time <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Controller
                name="start_time"
                control={control}
                render={({ field }) => (
                  <TimePicker
                    id="edit-start"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    clearable
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">End time <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Controller
                name="end_time"
                control={control}
                render={({ field }) => (
                  <TimePicker
                    id="edit-end"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    clearable
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-venue">Venue <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="edit-venue" placeholder="e.g. Examination Hall A" {...register("venue")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="edit-notes" {...register("notes")} />
          </div>

          {serverError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <p className="text-destructive text-sm">{serverError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}