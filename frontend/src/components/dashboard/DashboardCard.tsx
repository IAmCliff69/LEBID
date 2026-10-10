import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  action?: { label: string; to: string };
  className?: string;
  children: ReactNode;
}

// The shared frame for every dashboard widget: a header (icon, title, a short
// summary and an optional link) and a body that scrolls on its own when the
// content is long.
export default function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
  children,
}: DashboardCardProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <header className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {action && (
          <Link
            to={action.to}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            {action.label}
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}