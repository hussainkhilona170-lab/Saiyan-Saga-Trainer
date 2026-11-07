import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BOSSES, type Boss, type StatKey } from "./data";
import { applyAction, initialState as initial, openSave, sealSave, trainingGain, type GameState } from "./engine";

export type { GameState } from "./engine";
export { formMult, gravMult, powerLevel, questDone } from "./engine";

const KEY = "db-training-sim-v1";
const SANDBOX_KEY = "db-training-sim-v1-sandbox";
const BACKUP_SUFFIX = "-backup";
export type SaveSlot = "main" | "sandbox";

type Ctx = {
  s: GameState;
  slot: SaveSlot;
  update: (fn: (d: GameState) => void) => void;
  train: (stat: StatKey) => number;
  trainGravity: () => void;
  reset: () => void;
  switchSlot: (target: SaveSlot) => void;
  restore: (state: GameState) => void;
  shake: number;
  triggerShake: () => void;
};
const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<GameState>(initial);
  const [loaded, setLoaded] = useState(false);
  const [slot, setSlot] = useState<SaveSlot>("main");
  const [shake, setShake] = useState(0);
  const ref = useRef(s);
  ref.current = s;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const lastBackupRef = useRef(0);
  const key = slot === "main" ? KEY : SANDBOX_KEY;

  // Loads a slot with corruption fallback: if the save text is malformed,
  // openSave returns null and the caller can fall back to a backup or defaults.
  const loadSlot = (slotKey: string): GameState | null => {
    try { return openSave(localStorage.getItem(slotKey)); } catch { return null; }
  };

  useEffect(() => {
    let next = loadSlot(KEY);
    if (!next) next = loadSlot(KEY + BACKUP_SUFFIX);
    if (next) setS(next);
    setLoaded(true);
  }, []);
  // Saves the versioned envelope; every 30s it also snapshots the last good
  // save into a backup key so a future corrupted write can be rolled back.
  useEffect(() => {
    if (!loaded) return;
    try {
      const prev = localStorage.getItem(key);
      localStorage.setItem(key, sealSave(s));
      if (prev && Date.now() - lastBackupRef.current > 30_000) {
        lastBackupRef.current = Date.now();
        if (openSave(prev)) localStorage.setItem(key + BACKUP_SUFFIX, prev);
      }
    } catch {}
  }, [s, loaded, key]);

  const update = useCallback((fn: (d: GameState) => void) => {
    setS((prev) => { const d = structuredClone(prev); fn(d); if (d.infiniteZeni) d.zeni = 1e15; return d; });
  }, []);

  const train = useCallback((stat: StatKey) => {
    const g = trainingGain(ref.current);
    update((d) => applyAction(d, { type: "TRAIN_STAT", stat }));
    return g;
  }, [update]);

  const trainGravity = useCallback(() => update((d) => applyAction(d, { type: "TRAIN_GRAVITY" })), [update]);

  // Switch save slots: persists the current slot, loads the target one.
  // A fresh sandbox starts as a clone of the main save; both stay isolated.
  const switchSlot = useCallback((target: SaveSlot) => {
    if (target === slotRef.current) return;
    const fromKey = slotRef.current === "main" ? KEY : SANDBOX_KEY;
    const toKey = target === "main" ? KEY : SANDBOX_KEY;
    try { localStorage.setItem(fromKey, JSON.stringify(ref.current)); } catch {}
    let next: GameState | null = null;
    try {
      const raw = localStorage.getItem(toKey);
      if (raw) next = openSave(raw);
    } catch {}
    if (!next && target === "sandbox") next = structuredClone(ref.current);
    if (!next) next = structuredClone(initial);
    setSlot(target);
    setS(next);
  }, []);

  const restore = useCallback((state: GameState) => setS(state), []);

  // regen + auto-train tick
  useEffect(() => {
    const t = setInterval(() => {
      update((d) => applyAction(d, { type: "TICK" }));
    }, 250);
    return () => clearInterval(t);
  }, [update]);

  const triggerShake = useCallback(() => { setShake((n) => n + 1); }, []);
  const reset = useCallback(() => {
    try { localStorage.removeItem(slotRef.current === "main" ? KEY : SANDBOX_KEY); } catch {}
    setS(structuredClone(initial));
  }, []);

  return <GameCtx.Provider value={{ s, slot, update, train, trainGravity, reset, switchSlot, restore, shake, triggerShake }}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}

export const findBoss = (id: string): Boss | undefined => BOSSES.find((b) => b.id === id);
