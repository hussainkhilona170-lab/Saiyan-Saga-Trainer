import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BOSSES, type Boss, type StatKey } from "./data";
import { applyAction, hydrate, initialState as initial, trainingGain, type GameState } from "./engine";
import { backupKey, encodeSlot, resolveInitialLoad, slotKey, type SlotKind } from "./persistence";

export type { GameState } from "./engine";
export { formMult, gravMult, powerLevel, questDone } from "./engine";

export type SaveSlot = SlotKind;

type Ctx = {
  s: GameState;
  slot: SaveSlot;
  recoveredFromBackup: boolean;
  update: (fn: (d: GameState) => void) => void;
  train: (stat: StatKey) => number;
  trainGravity: () => void;
  reset: () => void;
  switchSlot: (target: SaveSlot) => void;
  restore: (state: unknown) => void;
  shake: number;
  triggerShake: () => void;
};
const GameCtx = createContext<Ctx | null>(null);

const SAVE_THROTTLE_MS = 750;
const BACKUP_INTERVAL_MS = 30_000;

export function GameProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<GameState>(initial);
  const [loaded, setLoaded] = useState(false);
  const [slot, setSlot] = useState<SaveSlot>("main");
  const [recoveredFromBackup, setRecoveredFromBackup] = useState(false);
  const [shake, setShake] = useState(0);
  const ref = useRef(s);
  ref.current = s;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const lastWriteRef = useRef(0);
  const lastBackupRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<GameState | null>(null);

  // Seals and writes the slot. If a parseable save already exists there and the
  // backup window elapsed, rotate it into the -backup key first so a bad write
  // can be rolled back.
  const persist = useCallback((slotKind: SaveSlot, state: GameState) => {
    try {
      const key = slotKey(slotKind);
      const encoded = encodeSlot(state);
      const prev = localStorage.getItem(key);
      if (prev && Date.now() - lastBackupRef.current > BACKUP_INTERVAL_MS) {
        lastBackupRef.current = Date.now();
        if (resolveInitialLoad(prev, null).state) localStorage.setItem(backupKey(slotKind), prev);
      }
      localStorage.setItem(key, encoded);
      lastWriteRef.current = Date.now();
      pendingSaveRef.current = null;
    } catch {
      // Storage unavailable (quota/private mode): the in-memory state stays authoritative.
    }
  }, []);

  useEffect(() => {
    try {
      const result = resolveInitialLoad(localStorage.getItem(slotKey("main")), localStorage.getItem(backupKey("main")));
      if (result.state) setS(result.state);
      setRecoveredFromBackup(result.recoveredFromBackup);
    } catch {
      // Storage unreadable: stay on defaults.
    }
    setLoaded(true);
  }, []);

  // Throttled writer: bursts (training clicks, the 250 ms TICK) coalesce into at
  // most one localStorage write per SAVE_THROTTLE_MS instead of several per second.
  useEffect(() => {
    if (!loaded) return;
    pendingSaveRef.current = s;
    const now = Date.now();
    const elapsed = now - lastWriteRef.current;
    if (elapsed >= SAVE_THROTTLE_MS) {
      persist(slotRef.current, s);
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current) persist(slotRef.current, pendingSaveRef.current);
      saveTimerRef.current = null;
    }, SAVE_THROTTLE_MS - elapsed);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [s, loaded, persist]);

  // Flush the pending save on exit so a mid-throttle page close never loses work.
  useEffect(() => {
    const flush = () => { if (pendingSaveRef.current) persist(slotRef.current, pendingSaveRef.current); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [persist]);

  const update = useCallback((fn: (d: GameState) => void) => {
    setS((prev) => { const d = structuredClone(prev); fn(d); return d; });
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
    const currentSlot = slotRef.current;
    const current = ref.current;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    persist(currentSlot, current);
    let next: GameState | null = null;
    let recovered = false;
    try {
      const result = resolveInitialLoad(localStorage.getItem(slotKey(target)), localStorage.getItem(backupKey(target)));
      next = result.state;
      recovered = result.recoveredFromBackup;
    } catch {
      next = null;
    }
    if (!next && target === "sandbox") next = structuredClone(current);
    if (!next) next = structuredClone(initial);
    setSlot(target);
    setRecoveredFromBackup(recovered);
    setS(next);
  }, [persist]);

  // Restores a snapshot/imported save: hydrate re-validates shape, so garbage
  // inputs can never reach the live state.
  const restore = useCallback((state: unknown) => setS(hydrate(state)), []);

  // regen + auto-train tick
  useEffect(() => {
    const t = setInterval(() => {
      update((d) => applyAction(d, { type: "TICK" }));
    }, 250);
    return () => clearInterval(t);
  }, [update]);

  const triggerShake = useCallback(() => { setShake((n) => n + 1); }, []);
  const reset = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = null;
    try { localStorage.removeItem(slotKey(slotRef.current)); } catch { /* slot may be locked; the fresh state below still lands */ }
    setS(structuredClone(initial));
  }, []);

  return <GameCtx.Provider value={{ s, slot, recoveredFromBackup, update, train, trainGravity, reset, switchSlot, restore, shake, triggerShake }}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}

export const findBoss = (id: string): Boss | undefined => BOSSES.find((b) => b.id === id);
