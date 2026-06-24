"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";

/**
 * Full-screen branded overlay that shows instantly on route change.
 * Unlike loading.tsx (which waits for the route to compile), this fires
 * on pathname change via useLayoutEffect — before the new page paints.
 * Fades out once the new route is ready (after minimum visible time).
 */
const MIN_MS = 600;

export function RouteOverlay() {
  const pathname = usePathname();
  const [show, setShow] = React.useState(false);
  const start = React.useRef(0);
  const raf = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useLayoutEffect(() => {
    setShow(true);
    start.current = performance.now();
    cancelAnimationFrame(raf.current);

    // Fade out after the minimum time — the new page is usually ready by then.
    timer.current = setTimeout(() => setShow(false), MIN_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-grey-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <ProfJohnsLogo size={96} className="animate-wordmark" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
