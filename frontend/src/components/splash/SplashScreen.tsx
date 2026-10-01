import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";

import LebidLogo from "@/components/brand/LebidLogo";

// How long the splash stays on screen (the spec asks for ~3 seconds).
const SPLASH_DURATION_MS = 3000;

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  // True if the user's device asks for less motion (accessibility).
  const prefersReducedMotion = useReducedMotion();

  // After 3 seconds, tell the parent (App) that the splash is finished.
  useEffect(() => {
    const timer = window.setTimeout(onComplete, SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  // Animation timeline across the full 3 seconds:
  // 0.0s -> 0.5s : fade in   (times 0 -> 0.17)
  // 0.5s -> 2.6s : hold      (times 0.17 -> 0.87)
  // 2.6s -> 3.0s : fade out  (times 0.87 -> 1)
  const times = [0, 0.17, 0.87, 1];

  return (
    <motion.main
      role="status"
      aria-label="Lebid is loading"
      className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: SPLASH_DURATION_MS / 1000, times, ease: "easeInOut" }}
    >
      {/* Soft terracotta glow behind the logo */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, color-mix(in srgb, var(--primary) 14%, transparent), transparent 60%)",
        }}
      />

      <motion.div
        className="relative"
        initial={{ scale: 0.9 }}
        animate={{ scale: prefersReducedMotion ? 1 : [0.9, 1, 1, 1.04] }}
        transition={{ duration: SPLASH_DURATION_MS / 1000, times, ease: "easeOut" }}
      >
        <LebidLogo className="w-[min(90vw,640px)]" />
      </motion.div>
    </motion.main>
  );
}