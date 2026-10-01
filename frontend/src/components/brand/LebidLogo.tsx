import logoUrl from "@/assets/brand/lebid-logo.svg";
import { cn } from "@/lib/utils";

interface LebidLogoProps {
  className?: string;
  alt?: string;
}

// The Lebid wordmark. Control the size from outside with className,
// e.g. <LebidLogo className="w-64" />
export default function LebidLogo({ className, alt = "Lebid" }: LebidLogoProps) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      draggable={false}
      className={cn("h-auto select-none", className)}
    />
  );
}