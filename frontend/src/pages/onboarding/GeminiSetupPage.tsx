import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";

import { saveGeminiKey } from "@/api/users";
import { useAuth } from "@/context/AuthContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

// Where students go to create their free Gemini API key.
const AI_STUDIO_URL = "https://aistudio.google.com/apikey";

const STEPS = [
  "Open Google AI Studio",
  "Sign in with Google",
  "Go to API Keys",
  "Create an API key",
  "Copy your API key",
];

// The backend also checks the key with Google. This only catches
// obvious mistakes (empty or far too short) before we send anything.
const keySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "That looks too short to be a Gemini API key")
    .max(255, "That key is too long"),
});

type KeyFormData = z.infer<typeof keySchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

export default function GeminiSetupPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [showKey, setShowKey] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const form = useForm<KeyFormData>({
    resolver: zodResolver(keySchema),
    defaultValues: { apiKey: "" },
  });

  const onSubmit = async (data: KeyFormData) => {
    setServerError(null);
    try {
      // The backend checks the key with Google and only saves it if it works.
      await saveGeminiKey(data.apiKey);

      // The key itself is never kept in the browser. We only remember
      // that this user now has one.
      if (user) setUser({ ...user, has_gemini_api_key: true });

      // Clear the key from the form, then show the success state.
      form.reset({ apiKey: "" });
      setVerified(true);
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(
          error,
          "We couldn't reach Lebid to check your key. Please try again."
        )
      );
    }
  };

  // After the success state shows for a moment, move on.
  // TODO: when the Academic Information page exists, go there instead.
  useEffect(() => {
    if (!verified) return;
    const timer = window.setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [verified, navigate]);

  const isSubmitting = form.formState.isSubmitting;
  const keyError = form.formState.errors.apiKey;

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
        className="relative my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Small logo top-left */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col px-6 pb-8 pt-4 sm:px-8 sm:pb-10">
          <h1
            className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={friendlyFont}
          >
            Let&apos;s power up Lebid&apos;s AI ✨
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            Lebid uses Google Gemini to understand your timetable and help
            create smarter academic plans. It takes about a minute to get your
            free key:
          </p>

          <ol className="mb-5 flex flex-col gap-2.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>

          <a
            href={AI_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mb-6 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary/40 px-5 text-sm font-semibold text-primary transition",
              "hover:bg-primary/10 active:scale-[0.98]"
            )}
          >
            Open Google AI Studio
            <ExternalLink className="size-4" />
          </a>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div>
              <label
                htmlFor="gemini-key"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  id="gemini-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste your key here"
                  disabled={isSubmitting || verified}
                  aria-invalid={!!keyError}
                  className={cn(
                    "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition",
                    "placeholder:text-muted-foreground",
                    "focus:border-ring focus:ring-2 focus:ring-ring/25",
                    "disabled:opacity-70",
                    (keyError || serverError) &&
                      "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
                  {...form.register("apiKey", {
                    // Typing a new key clears the old error message.
                    onChange: () => setServerError(null),
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {keyError && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {keyError.message}
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

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              Your API key is handled securely and is never stored in your
              browser.
            </p>

            <button
              type="submit"
              disabled={isSubmitting || verified}
              className={cn(
                "mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-sm transition",
                "hover:bg-primary-hover active:scale-[0.98]",
                "disabled:cursor-default disabled:opacity-80"
              )}
            >
              {verified ? (
                <>
                  <Check className="size-4" />
                  Key verified
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking your key…
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