"use client";

import * as React from "react";
import {
  PencilSimpleLine as PenLine,
  UploadSimple as Upload,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  X,
  CaretDown as ChevronDown,
} from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { deriveStyleProfile } from "@/lib/ai-client";
import { readPdfText } from "@/lib/sources-client";
import { cn } from "@/lib/utils";

const MIN_SAMPLE = 200;

/**
 * Lily — the writing-voice agent. Learns the author's voice from a sample
 * (pasted text or an uploaded paper) into an account-level profile, and lets
 * the writer condition drafts on it via the "Write in my voice" toggle.
 */
export function LilyVoice({
  useVoice,
  onToggleVoice,
}: {
  useVoice: boolean;
  onToggleVoice: (v: boolean) => void;
}) {
  const styleProfile = useWorkspaceStore((s) => s.styleProfile);
  const setStyleProfile = useWorkspaceStore((s) => s.setStyleProfile);

  const [training, setTraining] = React.useState(false);
  const [sample, setSample] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showProfile, setShowProfile] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function learn() {
    if (sample.trim().length < MIN_SAMPLE || busy) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await deriveStyleProfile(sample);
      setStyleProfile(profile);
      onToggleVoice(true);
      setTraining(false);
      setSample("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lily could not learn that.");
    } finally {
      setBusy(false);
    }
  }

  async function onPdf(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await readPdfText(file);
      setSample((prev) => (prev ? `${prev}\n\n${text}` : text));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not read that PDF.");
    } finally {
      setBusy(false);
    }
  }

  // Trained — compact status + voice toggle.
  if (styleProfile && !training) {
    return (
      <div className="rounded-lg border border-grey-200 bg-grey-50/60 p-2.5">
        <div className="flex items-center gap-2">
          <PenLine className="size-3.5 shrink-0 text-[var(--color-node-writing)]" />
          <span className="text-[11.5px] font-medium text-ink">Lily knows your voice</span>
          <button
            role="switch"
            aria-checked={useVoice}
            aria-label="Write in my voice"
            onClick={() => onToggleVoice(!useVoice)}
            className={cn(
              "relative ml-auto h-4 w-7 shrink-0 rounded-full transition-colors",
              useVoice ? "bg-ink" : "bg-grey-300",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-3 rounded-full bg-paper transition-all",
                useVoice ? "left-3.5" : "left-0.5",
              )}
            />
          </button>
        </div>
        <p className="mt-1 text-[10.5px] text-grey-500">
          {useVoice ? "Drafts are written in your voice." : "Voice off — drafts use a neutral tone."}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[10.5px]">
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-0.5 font-medium text-grey-600 hover:text-ink"
          >
            <ChevronDown className={cn("size-3 transition-transform", showProfile && "rotate-180")} />
            {showProfile ? "Hide" : "View"} profile
          </button>
          <button onClick={() => setTraining(true)} className="font-medium text-grey-600 hover:text-ink">
            Retrain
          </button>
          <button
            onClick={() => {
              setStyleProfile(null);
              onToggleVoice(false);
            }}
            className="font-medium text-grey-500 hover:text-red-500"
          >
            Forget
          </button>
        </div>
        {showProfile && (
          <p className="mt-2 whitespace-pre-wrap border-t border-grey-200 pt-2 text-[10.5px] leading-relaxed text-grey-600">
            {styleProfile}
          </p>
        )}
      </div>
    );
  }

  // Untrained, collapsed — invitation.
  if (!training) {
    return (
      <button
        onClick={() => setTraining(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-grey-200 px-3 py-2 text-left text-[11.5px] text-grey-500 transition-colors hover:border-grey-300 hover:text-ink"
      >
        <PenLine className="size-3.5 shrink-0 text-[var(--color-node-writing)]" />
        Teach Lily your writing voice
      </button>
    );
  }

  // Training composer.
  return (
    <div className="rounded-lg border border-grey-200 bg-paper p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <PenLine className="size-3.5 text-[var(--color-node-writing)]" />
        <span className="text-[11.5px] font-medium text-ink">Teach Lily your voice</span>
        <button
          onClick={() => {
            setTraining(false);
            setError(null);
          }}
          aria-label="Cancel"
          className="ml-auto grid size-5 place-items-center rounded text-grey-500 hover:bg-grey-100 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <textarea
        value={sample}
        onChange={(e) => setSample(e.target.value)}
        placeholder="Paste a few paragraphs of your own academic writing — or add a paper below."
        rows={5}
        className="w-full resize-none rounded-md border border-grey-200 bg-grey-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-ink outline-none placeholder:text-grey-500 focus:border-grey-300"
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onPdf(e.target.files?.[0])}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10.5px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink disabled:opacity-50"
        >
          <Upload className="size-3" />
          Add a paper
        </button>
        <button
          onClick={learn}
          disabled={busy || sample.trim().length < MIN_SAMPLE}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-ink px-3 py-1 text-[11px] font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <PenLine className="size-3" />}
          Learn my voice
        </button>
      </div>
      {sample.trim().length > 0 && sample.trim().length < MIN_SAMPLE && (
        <p className="mt-1.5 text-[10px] text-grey-500">
          {MIN_SAMPLE - sample.trim().length} more characters for a reliable read.
        </p>
      )}
      {error && (
        <p className="mt-1.5 flex items-start gap-1 text-[10.5px] leading-snug text-red-600">
          <AlertCircle className="mt-px size-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
