import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";


import { login } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

type AuthView = "default" | "name";

const SLIDE = { duration: 0.7, ease: [0.4, 0, 0.2, 1] as const };

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

export default function AuthPage({
  initialMode: _initialMode,
}: {
  initialMode: "login" | "register";
}) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const motionSafe = !prefersReducedMotion;

  const [authView, setAuthView] = useState<AuthView>("default");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [collectedName, setCollectedName] = useState("");

  const isName = authView === "name";

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onLogin = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const user = await login(data);
      setUser(user);
      navigate("/dashboard");
    } catch (error: unknown) {
      setServerError(getErrorMessage(error, "Invalid email or password."));
    }
  };

  const handleGetStarted = () => {
    setServerError(null);
    setAuthView("name");
  };

  const handleBackToDefault = () => {
    setAuthView("default");
  };

    const handleNameContinue = () => {
    const trimmed = collectedName.trim();
    if (trimmed.length < 2) return;
    navigate("/account-setup", { state: { name: trimmed } });
  };

  return (
    <main
      className="relative flex h-dvh max-h-dvh items-center justify-center overflow-hidden p-3 sm:p-5"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 40%, transparent)), url('/graduation-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Card fills available height, never overflows viewport */}
      <div className="relative h-full max-h-640px w-full max-w-5xl overflow-hidden rounded-2xl border border-border shadow-2xl">
        {/* ════════════════════════════════════════
            GIRL PANEL — slides left ↔ right
            ════════════════════════════════════════ */}
        <motion.div
          className="absolute top-0 h-full w-full sm:w-1/2"
          style={{
            backgroundImage: "url('/background.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          initial={false}
          animate={{ left: isName ? "50%" : "0%" }}
          transition={motionSafe ? SLIDE : { duration: 0 }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-black/40 via-black/15 to-black/5"
          />

          <div className="relative z-10 flex h-full flex-col px-5 py-5 sm:px-8 sm:py-6 md:px-10">
            <AnimatePresence mode="wait">
              {!isName ? (
                <motion.div
                  key="girl-signin"
                  initial={motionSafe ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionSafe ? { opacity: 0, y: -12 } : undefined}
                  transition={{ duration: 0.35 }}
                  className="flex h-full flex-col"
                >
                  {/* Small logo — top-left */}
                  <motion.div
                    layoutId="side-logo-left"
                    transition={SLIDE}
                    className="w-14 shrink-0 sm:w-16"
                  >
                    <LebidLogo className="w-full drop-shadow-md" />
                  </motion.div>

                  {/* Centered content */}
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                    <motion.div
                      layoutId="main-logo"
                      transition={SLIDE}
                      className="mb-3 w-32 sm:mb-4 sm:w-40"
                    >
                      <LebidLogo className="w-full drop-shadow-md" />
                    </motion.div>

                    <p
                      className="mb-0.5 text-sm font-semibold uppercase tracking-[0.18em] text-white/90 drop-shadow sm:text-base"
                      style={friendlyFont}
                    >
                      Sign In
                    </p>
                    <h1
                      className="mb-1 text-center text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl"
                      style={friendlyFont}
                    >
                      Welcome back!
                    </h1>
                    <p className="mb-5 text-center text-base text-white/90 drop-shadow sm:mb-6 sm:text-lg">
                      Your planner is waiting.
                    </p>

                    <form
                      onSubmit={loginForm.handleSubmit(onLogin)}
                      className="flex w-full max-w-sm flex-col gap-3"
                      noValidate
                    >
                      <div>
                        <label
                          htmlFor="auth-email"
                          className="mb-1 block text-sm font-medium text-white drop-shadow"
                        >
                          Email
                        </label>
                        <input
                          id="auth-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          aria-invalid={!!loginForm.formState.errors.email}
                          className={cn(
                            "w-full rounded-lg border border-white/40 bg-white/90 px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                            "placeholder:text-muted-foreground",
                            "focus:border-white focus:ring-2 focus:ring-white/40",
                            loginForm.formState.errors.email &&
                              "border-destructive focus:border-destructive"
                          )}
                          {...loginForm.register("email")}
                        />
                        {loginForm.formState.errors.email && (
                          <p className="mt-1 text-xs text-red-200" role="alert">
                            {loginForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label
                            htmlFor="auth-password"
                            className="block text-sm font-medium text-white drop-shadow"
                          >
                            Password
                          </label>
                          <button
                            type="button"
                            className="text-xs font-medium text-white/90 underline-offset-2 hover:underline"
                            onClick={() =>
                              alert("Forgot password flow will be added later.")
                            }
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            id="auth-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            aria-invalid={!!loginForm.formState.errors.password}
                            className={cn(
                              "w-full rounded-lg border border-white/40 bg-white/90 px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition",
                              "placeholder:text-muted-foreground",
                              "focus:border-white focus:ring-2 focus:ring-white/40",
                              loginForm.formState.errors.password &&
                                "border-destructive focus:border-destructive"
                            )}
                            {...loginForm.register("password")}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                        {loginForm.formState.errors.password && (
                          <p className="mt-1 text-xs text-red-200" role="alert">
                            {loginForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>

                      {serverError && (
                        <p
                          role="alert"
                          className="rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-2 text-xs text-white"
                        >
                          {serverError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={loginForm.formState.isSubmitting}
                        className={cn(
                          "mt-0.5 flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-md transition",
                          "hover:bg-primary-hover active:scale-[0.98]",
                          "disabled:cursor-wait disabled:opacity-70"
                        )}
                      >
                        {loginForm.formState.isSubmitting
                          ? "Signing in…"
                          : "Sign In"}
                      </button>
                    </form>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="girl-name"
                  initial={motionSafe ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionSafe ? { opacity: 0, y: -12 } : undefined}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="flex h-full flex-col items-center justify-center text-center"
                >
                  <motion.div
                    layoutId="main-logo"
                    transition={SLIDE}
                    className="mb-5 w-36 sm:w-48"
                  >
                    <LebidLogo className="w-full drop-shadow-md brightness-0 invert" />
                  </motion.div>

                  <h2
                    className="mb-6 text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl"
                    style={friendlyFont}
                  >
                    Hey! What should I call you? 👋
                  </h2>

                  <div className="flex w-full max-w-xs flex-col gap-4">
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Enter your name"
                      value={collectedName}
                      onChange={(e) => setCollectedName(e.target.value)}
                      className={cn(
                        "w-full rounded-lg border border-white/40 bg-white/90 px-3.5 py-2.5 text-sm text-foreground outline-none transition",
                        "placeholder:text-muted-foreground",
                        "focus:border-white focus:ring-2 focus:ring-white/40"
                      )}
                    />
                    <button
                      type="button"
                      onClick={handleNameContinue}
                      disabled={collectedName.trim().length < 2}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold uppercase tracking-wider text-primary shadow-md transition",
                        "hover:bg-white/90 active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                    >
                      Continue
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════
            SOLID PANEL — slides right ↔ left
            ════════════════════════════════════════ */}
        <motion.div
          className="absolute top-0 h-full w-full bg-primary sm:w-1/2"
          initial={false}
          animate={{ left: isName ? "0%" : "50%" }}
          transition={motionSafe ? SLIDE : { duration: 0 }}
        >
          <div className="relative z-10 flex h-full flex-col px-5 py-5 sm:px-8 sm:py-6 md:px-10">
            <AnimatePresence mode="wait">
              {!isName ? (
                <motion.div
                  key="solid-getstarted"
                  initial={motionSafe ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionSafe ? { opacity: 0, y: -12 } : undefined}
                  transition={{ duration: 0.35 }}
                  className="flex h-full flex-col text-primary-foreground"
                >
                  {/* Small logo — top-right */}
                  <motion.div
                    layoutId="side-logo-right"
                    transition={SLIDE}
                    className="ml-auto w-14 shrink-0 sm:w-16"
                  >
                    <LebidLogo className="w-full brightness-0 invert" />
                  </motion.div>

                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                    <h2
                      className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl"
                      style={friendlyFont}
                    >
                      Hey there! 👋
                    </h2>
                    <p className="mb-8 max-w-65 text-base leading-relaxed text-primary-foreground/90 sm:text-lg">
                      Ready to make planning a little easier?
                    </p>

                    <button
                      type="button"
                      onClick={handleGetStarted}
                      className={cn(
                        "flex h-12 items-center gap-2 rounded-full border-2 border-primary-foreground/60 bg-transparent px-8 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition",
                        "hover:border-primary-foreground hover:bg-primary-foreground/10 active:scale-[0.98]"
                      )}
                    >
                      Get Started
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="solid-welcome"
                  initial={motionSafe ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionSafe ? { opacity: 0, y: -12 } : undefined}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="flex h-full flex-col text-primary-foreground"
                >
                  {/* Small logo — top-left */}
                  <motion.div
                    layoutId="side-logo-left"
                    transition={SLIDE}
                    className="w-14 shrink-0 sm:w-16"
                  >
                    <LebidLogo className="w-full brightness-0 invert" />
                  </motion.div>

                  <div className="flex min-h-0 flex-1 flex-col justify-center">
                    <h1
                      className="mb-1 text-3xl font-bold tracking-tight sm:text-4xl"
                      style={friendlyFont}
                    >
                      Welcome back!
                    </h1>
                    <p className="mb-8 max-w-65 text-base text-primary-foreground/85 sm:text-lg">
                      Please login to access your planner space
                    </p>
                    <button
                      type="button"
                      onClick={handleBackToDefault}
                      className={cn(
                        "flex h-11 w-full max-w-xs items-center justify-center rounded-full border-2 border-primary-foreground/60 bg-transparent text-sm font-semibold uppercase tracking-wider text-primary-foreground transition",
                        "hover:border-primary-foreground hover:bg-primary-foreground/10 active:scale-[0.98]"
                      )}
                    >
                      Sign In
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <ThemeToggle />
    </main>
  );
}