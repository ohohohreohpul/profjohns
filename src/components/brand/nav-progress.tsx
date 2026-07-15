"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

/**
 * A thin top progress bar that animates during route changes.
 * Fires immediately on pathname change (useLayoutEffect) and stays
 * visible for a minimum duration so it's always perceptible.
 */
const MIN_VISIBLE_MS = 800;

export function NavProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = React.useState(false);
  const startTime = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // useLayoutEffect fires before paint, so the bar appears instantly.
  React.useLayoutEffect(() => {
    setLoading(true);
    startTime.current = Date.now();

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);

  // Dismiss after minimum visible time.
  React.useEffect(() => {
    if (!loading) return;

    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    timer.current = setTimeout(() => setLoading(false), remaining);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loading, pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[60] h-1 origin-left"
          style={{ background: "var(--color-accent)" }}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.9, opacity: 1 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{
            scaleX: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.25 },
          }}
        />
      )}
    </AnimatePresence>
  );
}
