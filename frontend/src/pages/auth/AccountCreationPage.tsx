import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

import { register as registerApi, login } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const accountSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AccountFormData = z.infer<typeof accountSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

export default function AccountCreationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  // Name is passed via location state from AuthPage
  const name =
    (location.state as { name?: string } | null)?.name?.trim() || "there";

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
  });

  const onSubmit = async (data: AccountFormData) => {
    setServerError(null);
    try {
      await registerApi({
        name,
        email: data.email,
        password: data.password,
      });
      const user = await login({
        email: data.email,
        password: data.password,
      });
      setUser(user);
      // Next step of onboarding: Gemini API key setup
      navigate("/onboarding/gemini", { replace: true });
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(error, "Registration failed. Please try again.")
      );
    }
  };

  return (
    <main
      className="relative flex h-dvh max-h-dvh items-center justify-center overflow-hidden p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 40%, transparent)), url('/graduation-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Small logo top-left */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col px-6 pb-8 pt-4 sm:px-8 sm:pb-10">
          <h1
            className="mb-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={friendlyFont}
          >
            Nice to meet you, {name}! 👋
          </h1>
          <p
            className="mb-2 text-lg font-semibold text-foreground sm:text-xl"
            style={friendlyFont}
          >
            Let&apos;s get your account set up 🔐
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            Create your login details so your plans, timetable, and academic
            information stay yours.
          </p>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div>
              <label
                htmlFor="account-email"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!form.formState.errors.email}
                className={cn(
                  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                  "placeholder:text-muted-foreground",
                  "focus:border-ring focus:ring-2 focus:ring-ring/25",
                  form.formState.errors.email &&
                    "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="account-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="account-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  aria-invalid={!!form.formState.errors.password}
                  className={cn(
                    "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition",
                    "placeholder:text-muted-foreground",
                    "focus:border-ring focus:ring-2 focus:ring-ring/25",
                    form.formState.errors.password &&
                      "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
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
              {form.formState.errors.password && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="account-confirm"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="account-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  aria-invalid={!!form.formState.errors.confirmPassword}
                  className={cn(
                    "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition",
                    "placeholder:text-muted-foreground",
                    "focus:border-ring focus:ring-2 focus:ring-ring/25",
                    form.formState.errors.confirmPassword &&
                      "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
                  {...form.register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showConfirm ? "Hide password" : "Show password"
                  }
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {serverError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className={cn(
                "mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-sm transition",
                "hover:bg-primary-hover active:scale-[0.98]",
                "disabled:cursor-wait disabled:opacity-70"
              )}
            >
              {form.formState.isSubmitting
                ? "Creating account…"
                : "Create my account"}
              {!form.formState.isSubmitting && (
                <ArrowRight className="size-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      <ThemeToggle />
    </main>
  );
}