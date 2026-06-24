"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { LOGO_PATHS, BRAND_COLORS } from "@/components/brand/profjohns-logo";

const STEPS = [
  "Creating workspace",
  "Indexing source providers",
  "Priming the reading agent",
  "Laying out your canvas",
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function CinematicPreloader({
  direction,
  onComplete,
}: {
  direction: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = React.useState<
    "assembling" | "steps" | "dissolving"
  >("assembling");
  const [activeStep, setActiveStep] = React.useState(0);

  // Phase 1: SVG assembly (~1.4s) → Phase 2: Steps (~1.6s) → Phase 3: Dissolve (~0.5s)
  React.useEffect(() => {
    const toSteps = setTimeout(() => setPhase("steps"), 1500);
    return () => clearTimeout(toSteps);
  }, []);

  React.useEffect(() => {
    if (phase !== "steps") return;
    if (activeStep >= STEPS.length) {
      const toDissolve = setTimeout(() => setPhase("dissolving"), 400);
      return () => clearTimeout(toDissolve);
    }
    const next = setTimeout(() => setActiveStep((a) => a + 1), 400);
    return () => clearTimeout(next);
  }, [activeStep, phase]);

  React.useEffect(() => {
    if (phase !== "dissolving") return;
    const done = setTimeout(onComplete, 500);
    return () => clearTimeout(done);
  }, [phase, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{
        opacity: phase === "dissolving" ? 0 : 1,
      }}
      transition={{ duration: 0.5, ease: EASE }}
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 40%, oklch(97% 0.01 195), oklch(99% 0 0))",
      }}
    >
      <div className="flex flex-col items-center">
        {/* Logo assembly */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <AssemblingLogo active={phase !== "assembling"} />
        </motion.div>

        {/* Wordmark */}
        <motion.p
          className="mt-6 text-2xl font-semibold tracking-tight text-ink"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4, ease: EASE }}
        >
          ProfJohns
        </motion.p>

        {/* Direction text */}
        <motion.p
          className="mt-1.5 max-w-md text-center text-[13px] leading-relaxed text-grey-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.4, ease: EASE }}
        >
          {direction}
        </motion.p>

        {/* Progress bar */}
        <motion.div
          className="mt-8 h-0.5 w-48 overflow-hidden rounded-full bg-grey-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.3 }}
        >
          <motion.div
            className="h-full rounded-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.2, duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
            style={{ background: BRAND_COLORS.teal, transformOrigin: "left" }}
          />
        </motion.div>

        {/* Steps — appear after assembly */}
        <AnimatePresence>
          {phase !== "assembling" && (
            <motion.ul
              className="mt-6 space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {STEPS.map((step, i) => {
                const isDone = i < activeStep;
                const isCurrent = i === activeStep;
                return (
                  <motion.li
                    key={step}
                    className="flex items-center gap-2.5 px-3 py-1 text-[12px]"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{
                      opacity: isDone || isCurrent ? 1 : 0.35,
                      x: 0,
                    }}
                    transition={{ delay: i * 0.08, duration: 0.3, ease: EASE }}
                  >
                    <span className="grid size-3.5 place-items-center">
                      {isDone ? (
                        <motion.svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.3, ease: EASE }}
                        >
                          <motion.path
                            d="M2 6.5 L4.5 9 L10 3"
                            fill="none"
                            stroke={BRAND_COLORS.teal}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      ) : isCurrent ? (
                        <motion.span
                          className="block size-2 rounded-full"
                          style={{ background: BRAND_COLORS.teal }}
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      ) : (
                        <span className="block size-1.5 rounded-full bg-grey-300" />
                      )}
                    </span>
                    <span
                      className={
                        isDone || isCurrent ? "text-ink" : "text-grey-400"
                      }
                    >
                      {step}
                    </span>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AssemblingLogo({ active }: { active: boolean }) {
  const paths = [
    { ...LOGO_PATHS.body, delay: 0 },
    { ...LOGO_PATHS.hair, delay: 0.1 },
    { ...LOGO_PATHS.browLeft, delay: 0.25 },
    { ...LOGO_PATHS.browRight, delay: 0.3 },
    { ...LOGO_PATHS.eyeLeft, delay: 0.4 },
    { ...LOGO_PATHS.eyeRight, delay: 0.45 },
    { ...LOGO_PATHS.nose, delay: 0.55 },
    { ...LOGO_PATHS.mouthDark, delay: 0.65 },
    { ...LOGO_PATHS.mouthAccent1, delay: 0.7 },
    { ...LOGO_PATHS.mouthAccent2, delay: 0.75 },
  ];

  return (
    <svg
      viewBox="0 0 2048 2048"
      width={240}
      height={240}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          fill={p.fill}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            delay: p.delay,
            duration: 0.4,
            ease: EASE,
          }}
          style={{ transformOrigin: "center", transformBox: "fill-box" }}
        />
      ))}
    </svg>
  );
}
