import { useAuth } from "@/context/AuthContext";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

interface UserAvatarProps {
  size?: keyof typeof SIZES;
  className?: string;
}

// The logged-in student's photo in a circle.
// Students without a photo see their initials instead.
export default function UserAvatar({ size = "md", className }: UserAvatarProps) {
  const { user } = useAuth();
  const imageUrl = useAvatarUrl();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary",
        SIZES[size],
        className
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${user?.full_name ?? "Student"}'s profile photo`}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(user?.full_name)}</span>
      )}
    </div>
  );
}