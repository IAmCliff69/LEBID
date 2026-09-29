import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/context/AuthContext";
import {
  changePassword,
  updateProfile,
} from "@/api/users";

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
// PASSWORD FORM
// =========================================================

const passwordSchema = z
  .object({
    current_password: z
      .string()
      .min(1, "Current password is required"),

    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters"),

    confirm_password: z.string(),
  })
  .refine(
    (data) => data.new_password === data.confirm_password,
    {
      message: "Passwords do not match",
      path: ["confirm_password"],
    }
  );

type PasswordFormData = z.infer<typeof passwordSchema>;

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

  const [passwordSuccess, setPasswordSuccess] =
    useState<string | null>(null);

  const [passwordError, setPasswordError] =
    useState<string | null>(null);

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

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
  // PASSWORD FORM
  // =======================================================

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),

    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
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

  // =======================================================
  // CHANGE PASSWORD
  // =======================================================

  const handlePasswordChange = async (
    data: PasswordFormData
  ) => {
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      const response = await changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });

      passwordForm.reset();

      setPasswordSuccess(
        response.message ||
          "Your password has been changed successfully."
      );
    } catch (error) {
      setPasswordError(
        getApiError(
          error,
          "Failed to change your password. Please try again."
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

      {/* ===================================================
          PASSWORD
      =================================================== */}

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>

            <div>
              <h3 className="text-lg font-semibold">
                Change password
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Update your account password securely.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={passwordForm.handleSubmit(
            handlePasswordChange
          )}
          className="max-w-xl space-y-5"
        >
          {/* Current password */}

          <div className="space-y-2">
            <Label htmlFor="current_password">
              Current password
            </Label>

            <div className="relative">
              <Input
                id="current_password"
                type={
                  showCurrentPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                {...passwordForm.register(
                  "current_password"
                )}
                className="pr-11"
              />

              <button
                type="button"
                onClick={() =>
                  setShowCurrentPassword(
                    (value) => !value
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label={
                  showCurrentPassword
                    ? "Hide current password"
                    : "Show current password"
                }
              >
                {showCurrentPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {passwordForm.formState.errors.current_password && (
              <p className="text-xs text-destructive">
                {
                  passwordForm.formState.errors
                    .current_password.message
                }
              </p>
            )}
          </div>

          {/* New password */}

          <div className="space-y-2">
            <Label htmlFor="new_password">
              New password
            </Label>

            <div className="relative">
              <Input
                id="new_password"
                type={
                  showNewPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                {...passwordForm.register(
                  "new_password"
                )}
                className="pr-11"
              />

              <button
                type="button"
                onClick={() =>
                  setShowNewPassword(
                    (value) => !value
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label={
                  showNewPassword
                    ? "Hide new password"
                    : "Show new password"
                }
              >
                {showNewPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {passwordForm.formState.errors.new_password && (
              <p className="text-xs text-destructive">
                {
                  passwordForm.formState.errors
                    .new_password.message
                }
              </p>
            )}
          </div>

          {/* Confirm password */}

          <div className="space-y-2">
            <Label htmlFor="confirm_password">
              Confirm new password
            </Label>

            <div className="relative">
              <Input
                id="confirm_password"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                {...passwordForm.register(
                  "confirm_password"
                )}
                className="pr-11"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) => !value
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label={
                  showConfirmPassword
                    ? "Hide password confirmation"
                    : "Show password confirmation"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {passwordForm.formState.errors
              .confirm_password && (
              <p className="text-xs text-destructive">
                {
                  passwordForm.formState.errors
                    .confirm_password.message
                }
              </p>
            )}
          </div>

          {/* Feedback */}

          {passwordError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">
                {passwordError}
              </p>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />

              <p className="text-sm text-primary">
                {passwordSuccess}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                passwordForm.formState.isSubmitting
              }
            >
              <KeyRound className="size-4" />

              {passwordForm.formState.isSubmitting
                ? "Changing..."
                : "Change password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}