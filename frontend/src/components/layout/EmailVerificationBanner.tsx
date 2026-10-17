import { useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

import { resendVerification } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";

const DISMISS_KEY = "lebid-verify-banner-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// A slim bar at the top of the app asking the student to verify their email.
// Dismissing it hides it until the next time the browser tab is opened.
export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Only shown when the server says the address is NOT verified
  if (!user || user.email_verified !== false || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      toast.success(await resendVerification());
      setSent(true);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: unknown } } })
        .response?.data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : "We couldn't send the email. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Not important: the banner just comes back next time.
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-warning/30 bg-warning/10 px-5 py-2.5 text-sm sm:px-6 lg:px-8"
    >
      <Mail className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-foreground">
        Please verify your email address. We sent a link to{" "}
        <span className="font-medium">{user.email}</span>.
      </p>
      <button
        type="button"
        onClick={handleResend}
        disabled={sending || sent}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
      >
        {sent ? "Email sent" : sending ? "Sending..." : "Resend email"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}