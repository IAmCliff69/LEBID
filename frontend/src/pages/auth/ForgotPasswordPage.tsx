import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { z } from "zod";

import { forgotPassword } from "@/api/auth";
import AuthCardLayout from "@/components/auth/AuthCardLayout";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30";

const buttonClass =
  "w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:opacity-60";

export default function ForgotPasswordPage() {
  const location = useLocation();
  // The login page passes along whatever the student had already typed
  const prefilledEmail =
    (location.state as { email?: string } | null)?.email ?? "";

  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefilledEmail },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      setConfirmation(await forgotPassword(data.email));
    } catch (error) {
      setServerError(
        getErrorMessage(error, "We couldn't send the email. Please try again.")
      );
    }
  };

  if (confirmation) {
    return (
      <AuthCardLayout title="Check your email">
        <div className="text-center">
          <Mail className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">{confirmation}</p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link to="/login" className={`${buttonClass} block text-center`}>
              Back to login
            </Link>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Use a different email
            </button>
          </div>
        </div>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout
      title="Forgot your password?"
      subtitle="Enter your email and we will send you a link to choose a new one."
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!form.formState.errors.email}
            className={inputClass}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className={buttonClass}
        >
          {form.formState.isSubmitting ? "Sending..." : "Send reset link"}
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