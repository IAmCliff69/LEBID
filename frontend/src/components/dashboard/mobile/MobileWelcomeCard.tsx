import { Link } from "react-router-dom";
import { Camera } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { getInitials } from "@/lib/avatar";

// The same friendly font the onboarding screens use
const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

const buttonBase =
  "inline-flex h-9 items-center justify-center rounded-full px-3.5 text-[10.5px] font-semibold uppercase tracking-wider transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground";

// The terracotta greeting card, with the student's photo sticking out of its
// top-right corner (the phone version of the desktop welcome banner).
export default function MobileWelcomeCard({ firstName }: { firstName: string }) {
  const { user } = useAuth();
  const imageUrl = useAvatarUrl();

  return (
    <section aria-label="Welcome" className="relative mt-9">
      <div className="relative rounded-3xl bg-linear-to-br from-primary to-primary-hover p-5 text-primary-foreground shadow-lg">
        {/* Decorative circles, clipped to the card's rounded corners */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        >
          <div className="absolute -right-14 -top-14 size-48 rounded-full bg-primary-foreground/10" />
          <div className="absolute -bottom-24 right-16 size-44 rounded-full bg-primary-foreground/10" />
        </div>

                {/* Text and buttons */}
        <div className="relative z-10">
          {/* Only the label and the heading make room for the photo */}
          <div className="pr-[112px]">
            <span className="inline-flex w-fit items-center rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-[11px] font-medium">
              Your academic workspace
            </span>

            <h2
              className="mt-2 text-[1.65rem] leading-[1.15] font-bold tracking-tight"
              style={friendlyFont}
            >
              Welcome back, {firstName}
            </h2>
          </div>

          {/* From here down the text can use the full width of the card */}
          <p className="mt-2 text-xs leading-5 text-primary-foreground/85">
            Stay on top of your classes, tasks, assignments, and study sessions
            from one place.
          </p>

          <div className="mt-3.5 flex gap-2">
            <Link
              to="/planner"
              className={`${buttonBase} flex-1 bg-[#5a1e2c] text-white hover:opacity-90 dark:bg-[#241a16] dark:text-[#f4ede4]`}
            >
              Open planner
            </Link>
            <Link
              to="/timetable"
              className={`${buttonBase} flex-1 border border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10`}
            >
              My timetable
            </Link>
          </div>
        </div>

        {/* The photo: it overlaps the card and sticks out above its top edge */}
          <div className="absolute -top-9 right-4 z-20 h-[140px] w-[100px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${user?.full_name ?? "Student"}'s profile photo`}
              className="size-full rounded-3xl object-cover shadow-2xl ring-4 ring-[#2a1d18] dark:ring-card"
            />
          ) : (
            <Link
              to="/settings"
              className="flex size-full flex-col items-center justify-center gap-1.5 rounded-3xl bg-primary-foreground/20 text-primary-foreground shadow-2xl ring-4 ring-[#2a1d18] backdrop-blur-sm transition hover:bg-primary-foreground/30 dark:ring-card"
            >
              <span className="text-4xl font-bold" style={friendlyFont}>
                {getInitials(user?.full_name)}
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium">
                <Camera className="size-3" />
                Add your photo
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}