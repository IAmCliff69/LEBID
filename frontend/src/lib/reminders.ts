// Remembers (for this browser tab only) that the login reminders were shown,
// so they don't repeat on every page change or refresh.
export const REMINDER_STORAGE_PREFIX = "lebid_reminders_shown_";

// Called on logout and when the session expires, so the next login shows
// the reminders again.
export function clearReminderFlags(): void {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(REMINDER_STORAGE_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // sessionStorage unavailable: nothing to clear
  }
}