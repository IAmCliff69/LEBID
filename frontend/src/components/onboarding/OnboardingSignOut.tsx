import { useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

// A small "Sign out" button shown only on the onboarding screens, so a
// student who is still setting up is never stuck in the wrong account.
export default function OnboardingSignOut() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  if (!pathname.startsWith("/onboarding/")) return null;

  return (
    <button
      type="button"
      onClick={() => {
        logout().catch(() => {
          // If signing out fails, nothing changes and the student can try again.
        });
      }}
      className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
    >
      <LogOut className="size-3.5" aria-hidden="true" />
      Sign out
    </button>
  );
}