import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { z } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";

import { updateProfile } from "@/api/users";
import { useAuth } from "@/context/AuthContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const academicSchema = z.object({
  university: z
    .string()
    .trim()
    .min(1, "Please select your university or school"),

  programme: z
    .string()
    .trim()
    .min(2, "Please enter your programme"),

  level: z
    .string()
    .min(1, "Please select your year of study"),

  semester: z
    .string()
    .min(1, "Please select your semester"),
});

type AcademicFormData = z.infer<typeof academicSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (
      error as {
        response?: {
          data?: {
            detail?: unknown;
          };
        };
      }
    ).response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

const friendlyFont = {
  fontFamily: '"Original Surfer", cursive',
};

const UNIVERSITIES = [
  "Kwame Nkrumah University of Science and Technology",
  "University of Ghana",
  "University of Cape Coast",
  "University for Development Studies",
  "University of Education, Winneba",
  "Ghana Institute of Management and Public Administration",
  "Ashesi University",
  "Academic City University College",
  "Other",
];

const LEVELS = [
  { value: "1", label: "Year 1" },
  { value: "2", label: "Year 2" },
  { value: "3", label: "Year 3" },
  { value: "4", label: "Year 4" },
  { value: "5", label: "Year 5" },
  { value: "6", label: "Year 6" },
];

const SEMESTERS = [
  { value: "First Semester", label: "First Semester" },
  { value: "Second Semester", label: "Second Semester" },
];

export default function AcademicInformationPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<AcademicFormData>({
    resolver: zodResolver(academicSchema),
    defaultValues: {
      university: user?.university ?? "",
      programme: user?.programme ?? "",
      level: user?.level ?? "",
      semester: user?.semester ?? "",
    },
  });

  const onSubmit = async (data: AcademicFormData) => {
    setServerError(null);

    try {
      const updatedUser = await updateProfile({
        university: data.university,
        programme: data.programme,
        level: data.level,
        semester: data.semester,
      });

      setUser(updatedUser);

      navigate("/onboarding/timetable", {
        replace: true,
      });
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(
          error,
          "We couldn't save your academic information. Please try again."
        )
      );
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 40%, transparent)), url('/graduation-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <motion.div
        initial={
          prefersReducedMotion ? false : { opacity: 0, y: 16 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Small logo */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col px-6 pb-8 pt-4 sm:px-8 sm:pb-10">
          <h1
            className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={friendlyFont}
          >
            Tell us a little about your studies 🎓
          </h1>

          <p className="mb-6 text-sm text-muted-foreground">
            These details help Lebid understand your academic world and your
            current semester.
          </p>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            {/* University */}
            <div>
              <label
                htmlFor="academic-university"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                University / School
              </label>

              <select
                id="academic-university"
                aria-invalid={!!form.formState.errors.university}
                disabled={isSubmitting}
                className={cn(
                  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                  "focus:border-ring focus:ring-2 focus:ring-ring/25",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                  form.formState.errors.university &&
                    "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...form.register("university")}
              >
                <option value="">Select university</option>

                {UNIVERSITIES.map((university) => (
                  <option key={university} value={university}>
                    {university}
                  </option>
                ))}
              </select>

              {form.formState.errors.university && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.university.message}
                </p>
              )}
            </div>

            {/* Programme */}
            <div>
              <label
                htmlFor="academic-programme"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Programme
              </label>

              <input
                id="academic-programme"
                type="text"
                autoComplete="organization-title"
                placeholder="e.g. Computer Engineering"
                disabled={isSubmitting}
                aria-invalid={!!form.formState.errors.programme}
                className={cn(
                  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                  "placeholder:text-muted-foreground",
                  "focus:border-ring focus:ring-2 focus:ring-ring/25",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                  form.formState.errors.programme &&
                    "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...form.register("programme")}
              />

              {form.formState.errors.programme && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.programme.message}
                </p>
              )}
            </div>

            {/* Year of Study */}
            <div>
              <label
                htmlFor="academic-level"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Year of Study
              </label>

              <select
                id="academic-level"
                aria-invalid={!!form.formState.errors.level}
                disabled={isSubmitting}
                className={cn(
                  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                  "focus:border-ring focus:ring-2 focus:ring-ring/25",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                  form.formState.errors.level &&
                    "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...form.register("level")}
              >
                <option value="">Select year</option>

                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>

              {form.formState.errors.level && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.level.message}
                </p>
              )}
            </div>

            {/* Semester */}
            <div>
              <label
                htmlFor="academic-semester"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Semester
              </label>

              <select
                id="academic-semester"
                aria-invalid={!!form.formState.errors.semester}
                disabled={isSubmitting}
                className={cn(
                  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                  "focus:border-ring focus:ring-2 focus:ring-ring/25",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                  form.formState.errors.semester &&
                    "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...form.register("semester")}
              >
                <option value="">Select semester</option>

                {SEMESTERS.map((semester) => (
                  <option key={semester.value} value={semester.value}>
                    {semester.label}
                  </option>
                ))}
              </select>

              {form.formState.errors.semester && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.semester.message}
                </p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {serverError}
              </p>
            )}

            {/* Continue */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-sm transition",
                "hover:bg-primary-hover active:scale-[0.98]",
                "disabled:cursor-wait disabled:opacity-70"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}