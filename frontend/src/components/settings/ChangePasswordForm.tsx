import { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { changePassword } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (
    error as { response?: { data?: { detail?: string | { msg?: string }[] } } }
  ).response?.data?.detail;

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
  }
  return fallback;
}

// One password box with a show/hide eye.
function PasswordField({
  id,
  label,
  autoComplete,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="pr-10"
          {...registration}
        />
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  const onSubmit = async (data: PasswordFormData) => {
    setServerError(null);
    try {
      await changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      form.reset();
      toast.success("Password changed", {
        description: "Your password has been updated.",
      });
    } catch (error) {
      setServerError(
        getErrorMessage(
          error,
          "Failed to change your password. Please try again."
        )
      );
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <PasswordField
        id="settings_current_password"
        label="Current password"
        autoComplete="current-password"
        error={errors.current_password?.message}
        registration={form.register("current_password")}
      />
      <PasswordField
        id="settings_new_password"
        label="New password"
        autoComplete="new-password"
        error={errors.new_password?.message}
        registration={form.register("new_password")}
      />
      <PasswordField
        id="settings_confirm_password"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        registration={form.register("confirm_password")}
      />

      {serverError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Changing password..." : "Change password"}
      </Button>
    </form>
  );
}