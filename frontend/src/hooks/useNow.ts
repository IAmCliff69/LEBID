import { useEffect, useState } from "react";

// The current time, refreshed every minute, so widgets like "Today's classes"
// update by themselves as time passes.
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}