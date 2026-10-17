import type { ReactNode } from "react";

import LebidLogo from "@/components/brand/LebidLogo";

interface AuthCardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// The look shared by the forgot-password and reset-password pages:
// the same graduation background as the login page, with a centred card.
export default function AuthCardLayout({
  title,
  subtitle,
  children,
}: AuthCardLayoutProps) {
  return (
    <main
      className="relative flex min-h-dvh items-center justify-center p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 40%, transparent)), url('/graduation-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <LebidLogo className="mx-auto mb-5 w-28" />
        <h1 className="text-center text-2xl font-semibold text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}