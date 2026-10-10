import { useQuery } from "@tanstack/react-query";

import { getAvatarUrl } from "@/api/users";
import { useAuth } from "@/context/AuthContext";

// Gives back a link to the logged-in student's photo (or undefined if they
// have none yet). The photo is downloaded once and shared by every place
// that shows it.
export function useAvatarUrl(): string | undefined {
  const { user } = useAuth();

  const { data } = useQuery({
    // A new avatar_updated_at means a new photo, so it is fetched again.
    queryKey: ["avatar", user?.id, user?.avatar_updated_at],
    queryFn: () => getAvatarUrl(user?.avatar_updated_at),
    enabled: !!user?.has_avatar,
    staleTime: Infinity,
  });

  return data;
}