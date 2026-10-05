import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";

import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { completeOnboarding } from "@/api/users";
import { useAuth } from "@/context/AuthContext";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export default function FinishSetupPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reaching this page means setup is done: record it right away.
  useEffect(() => {
    let cancelled = false;
    completeOnboarding()
      .then((updated) => {
        if (!cancelled) setUser(updated);
      })
      .catch(() => {
        // The button below tries again, so nothing to show here.
      });
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const handleGoToDashboard = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await completeOnboarding();
      setUser(updated);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "We couldn't finish your setup. Please try again.")
      );
      setSaving(false);
    }
  };

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
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative my-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Small logo top-left */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center sm:px-8 sm:pb-10">
          {/* A circle and a check mark that draw themselves (a calm finish) */}
          <svg
            viewBox="0 0 52 52"
            className="mb-5 size-16 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <motion.circle
              cx="26"
              cy="26"
              r="23"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            />
            <motion.path
              d="M15 27 l8 8 l14 -16"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }}
            />
          </svg>

          <h1
            className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={friendlyFont}
          >
            You&apos;re all set! 🎉
          </h1>
          <p className="mb-1 text-sm text-foreground">
            Your Lebid workspace is ready.
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            Once you add your timetable, Lebid can use it to build your
            personalized study plan.
          </p>

                    {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleGoToDashboard}
            disabled={saving}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            GO TO MY DASHBOARD
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}