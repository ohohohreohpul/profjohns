import { useStore } from "zustand";
import { useCanvasStore } from "./canvas-store";

/** Undo/redo state + actions, backed by zundo's temporal store. */
export function useTemporal() {
  const canUndo = useStore(
    useCanvasStore.temporal,
    (s) => s.pastStates.length > 0,
  );
  const canRedo = useStore(
    useCanvasStore.temporal,
    (s) => s.futureStates.length > 0,
  );
  return {
    canUndo,
    canRedo,
    undo: () => useCanvasStore.temporal.getState().undo(),
    redo: () => useCanvasStore.temporal.getState().redo(),
    clear: () => useCanvasStore.temporal.getState().clear(),
  };
}
