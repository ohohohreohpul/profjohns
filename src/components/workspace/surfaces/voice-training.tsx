"use client";

import * as React from "react";
import {
  PencilSimpleLine as PenLine,
  UploadSimple as Upload,
  CircleNotch as Loader2,
  WarningCircle as AlertCircle,
  Trash as Trash2,
  Plus,
  Check,
} from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useCorpusStore } from "@/store/corpus-store";
import { trainVoice } from "@/lib/voice-training";
import { readPdfText } from "@/lib/sources-client";

const MIN_CORPUS_CHARS = 200;

/**
 * Phase 3 — train the Stylist on the user's writing corpus. Add samples
 * (paste or PDF), then train: derives a StyleProfile + exemplars and stores
 * it in workspace.styleProfile, which the writer already consumes.
 */
export function VoiceTraining() {
  const samples = useCorpusStore((s) => s.samples);
  const addSample = useCorpusStore((s) => s.addSample);
  const removeSample = useCorpusStore((s) => s.removeSample);
  const hydrated = useCorpusStore((s) => s.hasHydrated);
  const styleProfile = useWorkspaceStore((s) => s.styleProfile);
  const setStyleProfile = useWorkspaceStore((s) => s.setStyleProfile);

  const [paste, setPaste] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showProfile, setShowProfile] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    void useCorpusStore.persist.rehydrate();
  }, []);

  const totalChars = samples.reduce((n, s) => n + s.text.length, 0);
  const canTrain = samples.length > 0 && totalChars >= MIN_CORPUS_CHARS;

  function commitPaste() {
    const text = paste.trim();
    if (text.length < 40) return;
    addSample(`Pasted sample ${samples.length + 1}`, text);
    setPaste("");
    setAdding(false);
  }

  async function onPdf(file: File | undefined) {
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    try {
      const text = await readPdfText(file);
      addSample(file.name.replace(/\.pdf$/i, ""), text);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not read that PDF.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function train() {
    if (!canTrain || busy) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await trainVoice(samples);
      setStyleProfile(profile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Training failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-grey-200 bg-paper p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <PenLine className="size-4 text-[var(--color-node-writing)]" />
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
          Writing voice
        </h2>
        {styleProfile && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Check className="size-3" />
            Trained
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-grey-500">
        Add samples of your own academic writing. The Stylist agent learns your
        voice from them and drafts in it — layered under the same voice toggle
        in the writer.
      </p>

      {/* Corpus list */}
      <div className="mt-4 flex flex-col gap-1.5">
        {hydrated && samples.length === 0 && (
          <p className="rounded-lg border border-dashed border-grey-200 px-3 py-4 text-center text-[12px] text-grey-500">
            No samples yet. Add a few paragraphs or a paper below.
          </p>
        )}
        {samples.map((s) => (
          <div
            key={s.id}
            data-testid={`corpus-sample-${s.id}`}
            className="flex items-center gap-2 rounded-lg border border-grey-200 bg-grey-50/60 px-3 py-2"
          >
            <PenLine className="size-3.5 shrink-0 text-grey-500" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
              {s.name}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] text-grey-500">
              {s.text.length.toLocaleString()} chars
            </span>
            <button
              onClick={() => removeSample(s.id)}
              aria-label={`Remove ${s.name}`}
              className="grid size-6 shrink-0 place-items-center rounded text-grey-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add controls */}
      {adding ? (
        <div className="mt-2 rounded-lg border border-grey-200 p-2.5">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste a few paragraphs of your own writing…"
            rows={4}
            data-testid="corpus-paste"
            className="w-full resize-y rounded-md border border-grey-200 bg-grey-50 px-2.5 py-2 text-[12px] leading-relaxed text-ink outline-none placeholder:text-grey-500 focus:border-grey-300"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setPaste("");
              }}
              className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-grey-500 hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={commitPaste}
              disabled={paste.trim().length < 40}
              data-testid="corpus-paste-add"
              className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
            >
              Add sample
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            data-testid="corpus-add-paste"
            className="inline-flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1.5 text-[12px] font-medium text-grey-700 transition-colors hover:border-grey-300 hover:bg-grey-50"
          >
            <Plus className="size-3.5" />
            Paste text
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onPdf(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadBusy}
            className="inline-flex items-center gap-1.5 rounded-md border border-grey-200 px-2.5 py-1.5 text-[12px] font-medium text-grey-700 transition-colors hover:border-grey-300 hover:bg-grey-50 disabled:opacity-50"
          >
            {uploadBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Add a paper (PDF)
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-red-600">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Train */}
      <div className="mt-4 flex items-center gap-3 border-t border-grey-100 pt-4">
        <button
          onClick={train}
          disabled={!canTrain || busy}
          data-testid="voice-train"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-grey-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
          {busy ? "Training…" : styleProfile ? "Re-train voice" : "Train my voice"}
        </button>
        {styleProfile && (
          <>
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="text-[12px] font-medium text-grey-600 hover:text-ink"
            >
              {showProfile ? "Hide" : "View"} profile
            </button>
            <button
              onClick={() => setStyleProfile(null)}
              className="text-[12px] font-medium text-grey-500 hover:text-red-500"
            >
              Forget
            </button>
          </>
        )}
        {!canTrain && samples.length > 0 && (
          <span className="text-[11px] text-grey-500">
            Add a little more text to train.
          </span>
        )}
      </div>

      {showProfile && styleProfile && (
        <p className="mt-3 max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-grey-100 bg-grey-50/60 p-3 text-[11.5px] leading-relaxed text-grey-600">
          {styleProfile}
        </p>
      )}
    </section>
  );
}
