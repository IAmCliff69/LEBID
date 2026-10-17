import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";

import GettingStartedCard from "@/components/dashboard/GettingStartedCard";
import MobileActivityOverview from "@/components/dashboard/mobile/MobileActivityOverview";
import MobileNextActivity from "@/components/dashboard/mobile/MobileNextActivity";
import MobileTodayCards from "@/components/dashboard/mobile/MobileTodayCards";
import MobileWelcomeCard from "@/components/dashboard/mobile/MobileWelcomeCard";
import { useAuth } from "@/context/AuthContext";
import { useUpcomingDeadlines } from "@/hooks/useUpcomingDeadlines";
import { getItemPath } from "@/lib/itemLinks";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

// The phone version of the Dashboard.
export default function MobileDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.full_name?.trim().split(" ")[0] || "there";
  const { upcoming, closest, isLoading } = useUpcomingDeadlines();

  const pillText = isLoading
    ? "Checking deadlines..."
    : upcoming.length === 0
      ? "No upcoming deadlines"
      : `${upcoming.length} Upcoming ${upcoming.length === 1 ? "Deadline" : "Deadlines"}`;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl leading-tight" style={friendlyFont}>
        Dashboard
      </h1>

      <MobileWelcomeCard firstName={firstName} />

      {/* Opens the closest deadline */}
      <div className="flex justify-end">
        {closest ? (
          <Link
            to={getItemPath(closest.type, closest.id)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted px-3.5 text-[13px] font-medium"
          >
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            {pillText}
          </Link>
        ) : (
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted px-3.5 text-[13px] font-medium">
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            {pillText}
          </span>
        )}
      </div>

      {/* New accounts only: disappears once everything is set up */}
      <GettingStartedCard />

      <MobileNextActivity />
      <MobileTodayCards />
      <MobileActivityOverview />
    </div>
  );
}