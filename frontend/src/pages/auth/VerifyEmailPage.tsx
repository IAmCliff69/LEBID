import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { getMe, resendVerification, verifyEmail } from "@/api/auth";
import LebidLogo from "@/components/brand/LebidLogo";
import { useAuth } from "@/context/AuthContext";

type Phase = "checking" | "success" | "failed";

function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

// The page the link in the verification email opens. It works whether or
// not the student is logged in on this device.
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { isAuthenticated, setUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  // The link works only once, so the check must run exactly ONCE even when
  // React runs effects twice in development.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) {
      setPhase("failed");
      setMessage("This link is incomplete. Please use the link from your email.");
      return;
    }

    verifyEmail(token)
      .then(async () => {
        setPhase("success");
        // If the student is logged in here, refresh their profile so the
        // "please verify" banner disappears.
        if (isAuthenticated) {
          try {
            setUser(await getMe());
          } catch {
            // Not important: the banner updates on the next page load.
          }
        }
      })
      .catch((error) => {
        setPhase("failed");
        setMessage(
          getErrorMessage(
            error,
            "We couldn't verify your email address. Please try again."
          )
        );
      });
  }, [token, isAuthenticated, setUser]);

  const handleResend = async () => {
    setResending(true);
    try {
      toast.success(await resendVerification());
    } catch (error) {
      toast.error(
        getErrorMessage(error, "We couldn't send the email. Please try again.")
      );
    } finally {
      setResending(false);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <LebidLogo className="mx-auto mb-6 w-32" />

        {phase === "checking" && (
          <>
            <Loader2
              className="mx-auto h-10 w-10 animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Verifying your email address...
            </p>
          </>
        )}

        {phase === "success" && (
          <>
            <CheckCircle2
              className="mx-auto h-10 w-10 text-success"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-semibold text-foreground">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you. Your email address is confirmed.
            </p>
            <div className="mt-6">
              <Link to={isAuthenticated ? "/dashboard" : "/login"} className={buttonClass}>
                {isAuthenticated ? "Continue to Lebid" : "Go to login"}
              </Link>
            </div>
          </>
        )}

        {phase === "failed" && (
          <>
            <XCircle
              className="mx-auto h-10 w-10 text-destructive"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-semibold text-foreground">
              We couldn&apos;t verify this link
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className={`${buttonClass} disabled:opacity-60`}
                >
                  {resending ? "Sending..." : "Send me a new link"}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Log in, then use the banner at the top of the app to get a new link.
                </p>
              )}
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {isAuthenticated ? "Back to Lebid" : "Go to login"}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}