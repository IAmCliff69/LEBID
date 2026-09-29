import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Check } from "lucide-react";

import { createCourse } from "@/api/courses";
import type { Course } from "@/api/courses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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

const addCourseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  name: z.string().min(2, "Course name must be at least 2 characters"),
  credit_hours: z.string().optional(),
});

type AddCourseFormData = z.infer<typeof addCourseSchema>;

interface AddCourseDialogProps {
  onCourseAdded: (course: Course) => void;
}

export default function AddCourseDialog({
  onCourseAdded,
}: AddCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(
    COLOR_OPTIONS[6].value
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddCourseFormData>({
    resolver: zodResolver(addCourseSchema),
  });

  const onSubmit = async (data: AddCourseFormData) => {
    setServerError(null);

    try {
      const course = await createCourse({
        code: data.code,
        name: data.name,
        credit_hours: data.credit_hours
          ? parseInt(data.credit_hours)
          : null,
        color: selectedColor,
      });

      onCourseAdded(course);

      reset();
      setSelectedColor(COLOR_OPTIONS[6].value);
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
          "Failed to create course. Please try again."
      );
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
          Add Course
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpenIcon />
          </div>

          <DialogTitle className="text-xl">
            Add a course
          </DialogTitle>

          <DialogDescription>
            Add the details of a course you're currently studying.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 space-y-5"
        >
          {/* Course code */}
          <div className="space-y-1.5">
            <Label htmlFor="code">Course code</Label>

            <Input
              id="code"
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

          {/* Course name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Course name</Label>

            <Input
              id="name"
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

          {/* Credit hours */}
          <div className="space-y-1.5">
            <Label htmlFor="credit_hours">
              Credit hours{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>

            <Input
              id="credit_hours"
              type="number"
              min={1}
              max={10}
              placeholder="e.g. 3"
              className="rounded-xl"
              {...register("credit_hours")}
            />
          </div>

          {/* Colour picker */}
          <div className="space-y-2">
            <div>
              <Label>Course colour</Label>

              <p className="mt-1 text-xs text-muted-foreground">
                Choose a colour to help identify this course.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              {COLOR_OPTIONS.map((color) => {
                const isSelected = selectedColor === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={`Select ${color.label}`}
                    title={color.label}
                    onClick={() => setSelectedColor(color.value)}
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

          {/* Server error */}
          {serverError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">
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
              disabled={isSubmitting}
              className="rounded-xl"
            >
              {isSubmitting ? "Adding..." : "Add course"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BookOpenIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4v16a2 2 0 0 0 2 2h16" />
      <path d="M6 2h12a2 2 0 0 1 2 2v16H6a2 2 0 0 0-2 2" />
      <path d="M6 2v18" />
    </svg>
  );
}