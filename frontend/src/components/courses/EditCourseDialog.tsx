import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Pencil } from "lucide-react";

import { updateCourse } from "@/api/courses";
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

const COLOR_OPTIONS = [
  { label: "Slate", value: "#64748b" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#22c55e" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
];

const editCourseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  name: z.string().min(2, "Course name must be at least 2 characters"),
  credit_hours: z.string().optional(),
});

type EditCourseFormData = z.infer<typeof editCourseSchema>;

interface EditCourseDialogProps {
  course: Course;
  onCourseUpdated: (course: Course) => void;
}

export default function EditCourseDialog({
  course,
  onCourseUpdated,
}: EditCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(
    course.color || COLOR_OPTIONS[6].value
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditCourseFormData>({
    resolver: zodResolver(editCourseSchema),
    defaultValues: {
      code: course.code,
      name: course.name,
      credit_hours:
        course.credit_hours !== null
          ? String(course.credit_hours)
          : "",
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      reset({
        code: course.code,
        name: course.name,
        credit_hours:
          course.credit_hours !== null
            ? String(course.credit_hours)
            : "",
      });

      setSelectedColor(
        course.color || COLOR_OPTIONS[6].value
      );

      setServerError(null);
    } else {
      setServerError(null);
    }
  };

  const onSubmit = async (data: EditCourseFormData) => {
    setServerError(null);

    try {
      const updatedCourse = await updateCourse(course.id, {
        code: data.code,
        name: data.name,
        credit_hours: data.credit_hours
          ? parseInt(data.credit_hours)
          : null,
        color: selectedColor,
      });

      onCourseUpdated(updatedCourse);
      setOpen(false);
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            detail?: string;
          };
        };
      };

      setServerError(
        error.response?.data?.detail ||
          "Failed to update course. Please try again."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl"
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Pencil className="size-5" />
          </div>

          <DialogTitle className="text-xl tracking-tight">
            Edit course
          </DialogTitle>

          <DialogDescription>
            Update the details and colour for this course.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 space-y-5"
        >
          {/* Course Code */}

          <div className="space-y-1.5">
            <Label htmlFor={`edit-code-${course.id}`}>
              Course code
            </Label>

            <Input
              id={`edit-code-${course.id}`}
              placeholder="e.g. COE 354"
              className="rounded-xl"
              {...register("code")}
            />

            {errors.code && (
              <p className="text-xs text-destructive">
                {errors.code.message}
              </p>
            )}
          </div>

          {/* Course Name */}

          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${course.id}`}>
              Course name
            </Label>

            <Input
              id={`edit-name-${course.id}`}
              placeholder="e.g. Operating Systems"
              className="rounded-xl"
              {...register("name")}
            />

            {errors.name && (
              <p className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Credit Hours */}

          <div className="space-y-1.5">
            <Label htmlFor={`edit-credit-${course.id}`}>
              Credit hours{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>

            <Input
              id={`edit-credit-${course.id}`}
              type="number"
              min={1}
              max={10}
              placeholder="e.g. 3"
              className="rounded-xl"
              {...register("credit_hours")}
            />

            {errors.credit_hours && (
              <p className="text-xs text-destructive">
                {errors.credit_hours.message}
              </p>
            )}
          </div>

          {/* Colour */}

          <div className="space-y-2">
            <div>
              <Label>Course colour</Label>

              <p className="mt-1 text-xs text-muted-foreground">
                Change the colour used to identify this course
                throughout Lebid.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              {COLOR_OPTIONS.map((color) => {
                const isSelected =
                  selectedColor === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={`Select ${color.label}`}
                    title={color.label}
                    onClick={() =>
                      setSelectedColor(color.value)
                    }
                    className="relative flex size-8 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{
                      backgroundColor: color.value,
                    }}
                  >
                    {isSelected && (
                      <Check className="size-4 text-white drop-shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}

          {serverError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">
                {serverError}
              </p>
            </div>
          )}

          {/* Actions */}

          <div className="flex justify-end gap-3 pt-2">
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
              disabled={isSubmitting}
              className="rounded-xl"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}