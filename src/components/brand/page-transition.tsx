"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { pageVariants } from "@/lib/motion-variants";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
