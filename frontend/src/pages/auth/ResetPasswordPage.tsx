import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

import { resetPassword } from "@/api/auth";
import AuthCardLayout from "@/components/auth/AuthCardLayout";
import { PASSWORD_TOO_LONG_MESSAGE, passwordFitsLimit } from "@/lib/passwordRules";

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine(passwordFitsLimit, PASSWORD_TOO_LONG_MESSAGE),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30";

const buttonClass =
  "w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:opacity-60";

// The page the link in the password reset email opens.
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // True when the server says the link itself is the problem (used or expired)
  const [linkProblem, setLinkProblem] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setServerError(null);
    setLinkProblem(false);
    try {
      setDone(await resetPassword(token, data.new_password));
    } catch (error) {
      const response = (
        error as {
          response?: { status?: number; data?: { detail?: unknown } };
        }
      ).response;
      const detail = response?.data?.detail;
      setLinkProblem(response?.status === 400);
      setServerError(
        typeof detail === "string"
          ? detail
          : "We couldn't reset your password. Please try again."
      );
    }
  };

  // No secret in the address: the link was cut off or this page was typed in
  if (!token) {
    return (
      <AuthCardLayout title="This link is incomplete">
        <p className="text-center text-sm text-muted-foreground">
          Please use the link from your email, or request a new one.
        </p>
        <Link
          to="/forgot-password"
          className={`${buttonClass} mt-6 block text-center`}
        >
          Request a new link
        </Link>
      </AuthCardLayout>
    );
  }

  if (done) {
    return (
      <AuthCardLayout title="Password reset">
        <div className="text-center">
          <CheckCircle2
            className="mx-auto h-10 w-10 text-success"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm text-muted-foreground">{done}</p>
          <Link to="/login" className={`${buttonClass} mt-6 block text-center`}>
            Log in
          </Link>
        </div>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout
      title="Choose a new password"
      subtitle="Use at least 8 characters. You will be signed out on all your devices."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <label
            htmlFor="reset-password"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.new_password}
              className={inputClass}
              {...form.register("new_password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {form.formState.errors.new_password && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {form.formState.errors.new_password.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reset-confirm"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.confirm_password}
            className={inputClass}
            {...form.register("confirm_password")}
          />
          {form.formState.errors.confirm_password && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {form.formState.errors.confirm_password.message}
            </p>
          )}
        </div>

        {serverError && (
          <div role="alert" className="text-sm text-destructive">
            <p>{serverError}</p>
            {linkProblem && (
              <Link
                to="/forgot-password"
                className="mt-1 inline-block font-medium underline underline-offset-4"
              >
                Request a new link
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className={buttonClass}
        >
          {form.formState.isSubmitting ? "Saving..." : "Reset password"}
        </button>

        <Link
          to="/login"
          className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to login
        </Link>
      </form>
    </AuthCardLayout>
  );
}