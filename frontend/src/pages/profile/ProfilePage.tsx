import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/api/users";;

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// =========================================================
// PROFILE FORM
// =========================================================

const profileSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters"),

  university: z.string(),

  programme: z.string(),

  level: z.string(),

  semester: z.string(),

  academic_year: z.string(),
});

type ProfileFormData = z.infer<typeof profileSchema>;



// =========================================================
// ERROR HELPER
// =========================================================

function getApiError(
  error: unknown,
  fallback: string
): string {
  const axiosError = error as {
    response?: {
      data?: {
        detail?: string | Array<{ msg?: string }>;
      };
    };
  };

  const detail = axiosError.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
  }

  return fallback;
}

// =========================================================
// PAGE
// =========================================================

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  const [profileSuccess, setProfileSuccess] =
    useState<string | null>(null);

  const [profileError, setProfileError] =
    useState<string | null>(null);

  // =======================================================
  // PROFILE FORM
  // =======================================================

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),

    defaultValues: {
      full_name: "",
      university: "",
      programme: "",
      level: "",
      semester: "",
      academic_year: "",
    },
  });

  // =======================================================
  // LOAD CURRENT USER INTO FORM
  // =======================================================

  useEffect(() => {
    if (!user) return;

    profileForm.reset({
      full_name: user.full_name ?? "",
      university: user.university ?? "",
      programme: user.programme ?? "",
      level: user.level ?? "",
      semester: user.semester ?? "",
      academic_year: user.academic_year ?? "",
    });
  }, [user, profileForm]);

  // =======================================================
  // UPDATE PROFILE
  // =======================================================

  const handleProfileUpdate = async (
    data: ProfileFormData
  ) => {
    setProfileSuccess(null);
    toast.success("Profile updated");
    setProfileError(null);

    try {
      const updatedUser = await updateProfile({
        full_name: data.full_name,
        university: data.university || "",
        programme: data.programme || "",
        level: data.level || "",
        semester: data.semester || "",
        academic_year: data.academic_year || "",
      });

      setUser(updatedUser);

      profileForm.reset({
        full_name: updatedUser.full_name ?? "",
        university: updatedUser.university ?? "",
        programme: updatedUser.programme ?? "",
        level: updatedUser.level ?? "",
        semester: updatedUser.semester ?? "",
        academic_year: updatedUser.academic_year ?? "",
      });

      setProfileSuccess(
        "Your profile has been updated successfully."
      );
    } catch (error) {
      setProfileError(
        getApiError(
          error,
          "Failed to update your profile. Please try again."
        )
      );
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="size-5" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Profile
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Manage your personal and academic information.
        </p>
      </section>

      {/* ===================================================
          PROFILE INFORMATION
      =================================================== */}

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">
            Personal & academic information
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Keep your information up to date so Lebid can
            personalize your academic planning.
          </p>
        </div>

        <form
          onSubmit={profileForm.handleSubmit(
            handleProfileUpdate
          )}
          className="space-y-6"
        >
          {/* Full name + Email */}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full name
              </Label>

              <Input
                id="full_name"
                {...profileForm.register("full_name")}
                placeholder="Your full name"
              />

              {profileForm.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {
                    profileForm.formState.errors.full_name
                      .message
                  }
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email
              </Label>

              <Input
                id="email"
                value={user?.email ?? ""}
                disabled
              />

              <p className="text-xs text-muted-foreground">
                Your email address cannot be changed here.
              </p>
            </div>
          </div>

          {/* University + Programme */}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="university">
                University
              </Label>

              <Input
                id="university"
                {...profileForm.register("university")}
                placeholder="e.g. KNUST"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="programme">
                Programme
              </Label>

              <Input
                id="programme"
                {...profileForm.register("programme")}
                placeholder="e.g. Computer Engineering"
              />
            </div>
          </div>

          {/* Level + Semester */}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="level">
                Level
              </Label>

              <Input
                id="level"
                {...profileForm.register("level")}
                placeholder="e.g. Level 300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">
                Semester
              </Label>

              <Input
                id="semester"
                {...profileForm.register("semester")}
                placeholder="e.g. First Semester"
              />
            </div>
          </div>

          {/* Academic year */}

          <div className="max-w-md space-y-2">
            <Label htmlFor="academic_year">
              Academic year
            </Label>

            <Input
              id="academic_year"
              {...profileForm.register("academic_year")}
              placeholder="e.g. 2026/2027"
            />
          </div>

          {/* Feedback */}

          {profileError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">
                {profileError}
              </p>
            </div>
          )}

          {profileSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />

              <p className="text-sm text-primary">
                {profileSuccess}
              </p>
            </div>
          )}

          {/* Save */}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                profileForm.formState.isSubmitting
              }
            >
              <Save className="size-4" />

              {profileForm.formState.isSubmitting
                ? "Saving..."
                : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

    </div>
  );
}