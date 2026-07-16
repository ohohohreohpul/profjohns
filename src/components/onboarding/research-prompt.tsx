"use client";

import * as React from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import Image from "next/image";

const EXAMPLES = [
  "Efficiency of retrieval-augmented generation vs. long-context models",
  "Mechanistic interpretability methods for transformer circuits",
  "Alignment techniques: RLHF, Constitutional AI, and successors",
];

export function ResearchPrompt({
  onSubmit,
  onStartBlank,
}: {
  onSubmit: (direction: string) => void;
  onStartBlank: (direction: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const canSubmit = value.trim().length >= 4;

  function handleSubmit() {
    if (canSubmit) onSubmit(value.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="mb-10 flex items-center gap-0 text-grey-500">
          <ProfJohnsLogo size={56} className="shrink-0 -mr-1" />
          <img
            src="/profjohns-text.svg"
            
            className="h-[26px] w-auto"
            alt="ProfJohns"
          />
          <span className="text-xs">research canvas</span>
        </div>

        <h1 className="tracking-display text-4xl font-semibold leading-[1.05] text-ink sm:text-6xl">
          What are you
          <br />
          researching?
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-grey-500">
          Describe your research direction. We&apos;ll set up a canvas with the
          right sources, reading, and writing nodes to start from.
        </p>

        <div className="mt-9">
          <Textarea
            autoFocus
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. How do retrieval-augmented models compare to long-context models on factual QA?"
            className="text-base"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-grey-500">⌘ + Enter to begin</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => onStartBlank(value.trim())}
              >
                Start blank
              </Button>
              <Button size="lg" disabled={!canSubmit} onClick={handleSubmit}>
                Set up canvas
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <p className="mb-3 text-xs uppercase tracking-wider text-grey-500">
            Or start from an example
          </p>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => setValue(example)}
                className="group flex items-center justify-between rounded-md border border-grey-200 bg-paper px-4 py-3 text-left text-sm text-grey-700 transition-colors hover:border-grey-400 hover:bg-grey-50"
              >
                <span>{example}</span>
                <ArrowRight className="size-4 text-grey-500 transition-colors group-hover:text-ink" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
