import { Link } from "react-router-dom";
import { Camera } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

// The same friendly font the onboarding screens use
const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

const buttonBase =
  "inline-flex h-11 items-center justify-center rounded-full px-6 text-xs font-semibold uppercase tracking-wider transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground dashboard-fit:h-9 dashboard-fit:px-5";

interface WelcomeBannerProps {
  firstName: string;
  className?: string;
}

export default function WelcomeBanner({ firstName, className }: WelcomeBannerProps) {
  const { user } = useAuth();
  const imageUrl = useAvatarUrl();

  return (
    <section
      aria-label="Welcome"
      className={cn(
        "flex flex-col dashboard-fit:min-h-0",
        className
      )}
    >
      {/* Empty space above the card, where the photo sticks up into it.
          (Hidden in the one-screen layout, where the label moves inside the card.) */}
      <div className="flex h-12 items-end sm:h-14 dashboard-fit:hidden">
        <span className="mb-3 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Your academic workspace
        </span>
      </div>

      <div className="relative min-h-52 rounded-3xl bg-linear-to-br from-primary to-primary-hover p-6 text-primary-foreground shadow-lg sm:p-8 dashboard-fit:flex dashboard-fit:min-h-0 dashboard-fit:flex-1 dashboard-fit:flex-col dashboard-fit:justify-center dashboard-fit:p-5">
        {/* Decorative circles, clipped to the card's rounded corners */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        >
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-primary-foreground/10" />
          <div className="absolute -bottom-24 right-40 size-56 rounded-full bg-primary-foreground/10" />
        </div>

        {/* Text and buttons (right padding leaves room for the photo) */}
        <div className="relative z-10 pr-36 sm:pr-56 lg:pr-72 dashboard-fit:pr-44">
          {/* The label, shown inside the card in the one-screen layout */}
          <span className="mb-2 hidden w-fit items-center rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-[11px] font-medium dashboard-fit:inline-flex">
            Your academic workspace
          </span>

          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl dashboard-fit:text-2xl"
            style={friendlyFont}
          >
            Welcome back, {firstName}
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/85 dashboard-fit:mt-1 dashboard-fit:text-xs dashboard-fit:leading-5 dashboard-tight:hidden">
            Stay on top of your classes, tasks, assignments, and study sessions
            from one place.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 dashboard-fit:mt-3 dashboard-fit:gap-2">
            <Link
              to="/planner"
              className={`${buttonBase} bg-primary-foreground text-primary hover:opacity-90`}
            >
              Open planner
            </Link>
            <Link
              to="/timetable"
              className={`${buttonBase} border border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10`}
            >
              My timetable
            </Link>
          </div>
        </div>

        {/* The photo: it overlaps the card and sticks out above its top edge */}
        <div className="absolute -top-12 right-5 z-20 h-44 w-32 sm:-top-14 sm:right-10 sm:h-56 sm:w-44 dashboard-fit:-top-6 dashboard-fit:bottom-3 dashboard-fit:right-4 dashboard-fit:h-auto dashboard-fit:w-36 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${user?.full_name ?? "Student"}'s profile photo`}
              className="size-full rounded-3xl object-cover shadow-2xl ring-4 ring-card"
            />
          ) : (
            <Link
              to="/settings"
              className="flex size-full flex-col items-center justify-center gap-2 rounded-3xl bg-primary-foreground/20 text-primary-foreground shadow-2xl ring-4 ring-card backdrop-blur-sm transition hover:bg-primary-foreground/30"
            >
              <span className="text-5xl font-bold" style={friendlyFont}>
                {getInitials(user?.full_name)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium">
                <Camera className="size-3.5" />
                Add your photo
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}