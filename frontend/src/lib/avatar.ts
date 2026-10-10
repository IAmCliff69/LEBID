export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB, same limit as the backend
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Returns a friendly message if the photo can't be used, or null if it's fine.
export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return "Please choose a JPEG, PNG or WebP photo.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "That photo is over 5 MB. Please choose a smaller one.";
  }
  return null;
}

// "Clifford Mensah" -> "CM", "Ama" -> "A"
export function getInitials(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}