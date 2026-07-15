"use client";

import { create } from "zustand";

/**
 * Sync status store — tracks the synchronization state of the canvas
 * and workspace for user-visible status indicators.
 *
 * States:
 *   idle      — no sync in progress
 *   loading   — loading from remote (initial hydrate)
 *   syncing   — writing to remote (debounced)
 *   saved     — successfully saved to cloud (transient, reverts to idle)
 *   offline   — network unavailable
 *   failed    — last sync attempt failed (retry available)
 *   conflict  — remote revision is newer than local (requires review)
 */

export type SyncStatus =
  | "idle"
  | "loading"
  | "syncing"
  | "saved"
  | "offline"
  | "failed"
  | "conflict";

export interface SyncState {
  status: SyncStatus;
  /** Timestamp of the last successful sync */
  lastSyncedAt: number | null;
  /** Error message when status is 'failed' or 'conflict' */
  error: string | null;
  /** Whether a retry is available */
  canRetry: boolean;

  setStatus: (status: SyncStatus, error?: string | null) => void;
  markSynced: () => void;
  markFailed: (error: string) => void;
  markOffline: () => void;
  reset: () => void;
}

export const useSyncStatus = create<SyncState>((set) => ({
  status: "idle",
  lastSyncedAt: null,
  error: null,
  canRetry: false,

  setStatus: (status, error = null) =>
    set({ status, error, canRetry: status === "failed" || status === "conflict" }),

  markSynced: () =>
    set({
      status: "saved",
      lastSyncedAt: Date.now(),
      error: null,
      canRetry: false,
      // Revert to idle after 2 seconds
    }),

  markFailed: (error) =>
    set({ status: "failed", error, canRetry: true }),

  markOffline: () =>
    set({ status: "offline", error: "You are offline. Changes are saved locally.", canRetry: false }),

  reset: () =>
    set({ status: "idle", error: null, canRetry: false }),
}));

/**
 * Hook to get a user-readable label for the current sync status.
 */
export function useSyncLabel(): string {
  const status = useSyncStatus((s) => s.status);
  switch (status) {
    case "idle": return "Saved locally";
    case "loading": return "Loading...";
    case "syncing": return "Syncing...";
    case "saved": return "Saved to cloud";
    case "offline": return "Offline";
    case "failed": return "Sync failed";
    case "conflict": return "Conflict requires review";
    default: return "";
  }
}
