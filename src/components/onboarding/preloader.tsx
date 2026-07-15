"use client";

import * as React from "react";
import { Check, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Creating workspace",
  "Indexing source providers",
  "Priming the reading agent",
  "Laying out your canvas",
];

const STEP_MS = 550;
const STAGGER_MS = 80;

export function Preloader({
  direction,
  onComplete,
}: {
  direction: string;
  onComplete: () => void;
}) {
  const [active, setActive] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Small delay before starting the step animation (let phase-in finish)
    const init = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(init);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    if (active >= STEPS.length) {
      const done = setTimeout(onComplete, 300);
      return () => clearTimeout(done);
    }
    const next = setTimeout(() => setActive((a) => a + 1), STEP_MS);
    return () => clearTimeout(next);
  }, [active, mounted, onComplete]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="mb-1 text-xs uppercase tracking-wider text-grey-500">
          Setting up your space
        </p>
        <p className="mb-8 line-clamp-2 text-lg font-medium leading-snug tracking-tight text-ink">
          {direction}
        </p>

        {/* Progress bar */}
        <div className="mb-6 h-0.5 w-full overflow-hidden rounded-full bg-grey-200">
          <div className="animate-progress-fill h-full rounded-full bg-ink" />
        </div>

        <ul className="space-y-1">
          {STEPS.map((step, i) => {
            const isDone = i < active;
            const isCurrent = i === active;
            const isPending = i > active;

            return (
              <li
                key={step}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  isCurrent && "bg-grey-100",
                )}
                style={{ animationDelay: mounted ? `${i * STAGGER_MS}ms` : undefined }}
              >
                <span className="grid size-5 place-items-center">
                  {isDone ? (
                    <span className="animate-check-draw">
                      <Check className="size-4 text-ink" />
                    </span>
                  ) : isCurrent ? (
                    <Loader2 className="size-4 animate-spin text-grey-500" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-grey-300" />
                  )}
                </span>
                <span
                  className={cn(
                    "transition-colors duration-300",
                    isDone || isCurrent ? "text-ink" : "text-grey-500",
                  )}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}