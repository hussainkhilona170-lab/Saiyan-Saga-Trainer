// Pure save-slot I/O helpers shared by the store and the God Engine. No React.
import { openSave, sealSave, SAVE_VERSION, type GameState } from "./engine";

export type SlotKind = "main" | "sandbox";
export const MAIN_KEY = "db-training-sim-v1";
export const SANDBOX_KEY = "db-training-sim-v1-sandbox";
export const BACKUP_SUFFIX = "-backup";
export const slotKey = (slot: SlotKind): string => (slot === "main" ? MAIN_KEY : SANDBOX_KEY);
export const backupKey = (slot: SlotKind): string => slotKey(slot) + BACKUP_SUFFIX;

/** Pretty, versioned export text (envelope + indentation) for the God Engine export box. */
export function exportSlotText(state: GameState): string {
  return JSON.stringify({ v: SAVE_VERSION, data: state } satisfies { v: number; data: GameState }, null, 2);
}

export type LoadResult = { state: GameState | null; recoveredFromBackup: boolean };

/**
 * Boot-time slot resolution with corruption fallback.
 * 1. If the primary save parses, use it.
 * 2. Otherwise fall back to the last-good backup rotated by the writer.
 * 3. Otherwise report null so the caller can start from defaults.
 */
export function resolveInitialLoad(mainText: string | null, backupText: string | null): LoadResult {
  const main = openSave(mainText);
  if (main) return { state: main, recoveredFromBackup: false };
  const backup = openSave(backupText);
  if (backup) return { state: backup, recoveredFromBackup: true };
  return { state: null, recoveredFromBackup: false };
}

/** Seals a state for writing; throws only on serializer failure (caller catches). */
export function encodeSlot(state: GameState): string {
  return sealSave(state);
}
