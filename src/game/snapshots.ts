// Schema-versioned snapshots for the God Engine / System tab. Pure functions, no storage.
import { hydrate, type GameState } from "./engine";
import type { SlotKind } from "./persistence";

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOTS_KEY = "db-god-engine-snapshots";

export type Snapshot = {
  version: number;
  name: string;
  createdAt: number;
  slot: SlotKind;
  state: GameState;
};

export function createSnapshot(state: GameState, name: string, slot: SlotKind, now = Date.now()): Snapshot {
  const cleanName = name.trim().slice(0, 60) || `Snapshot ${new Date(now).toISOString()}`;
  return { version: SNAPSHOT_VERSION, name: cleanName, createdAt: now, slot, state: hydrate(state) };
}

export function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(text: string): Snapshot | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const state = hydrate(r["state"]);
  if (!state) return null;
  const name = typeof r["name"] === "string" && r["name"].trim() ? r["name"].trim().slice(0, 60) : "Untitled snapshot";
  const createdAt = typeof r["createdAt"] === "number" && isFinite(r["createdAt"]) ? r["createdAt"] : Date.now();
  const slot: SlotKind = r["slot"] === "sandbox" ? "sandbox" : "main";
  return { version: SNAPSHOT_VERSION, name, createdAt, slot, state };
}

export function parseSnapshotList(text: string): Snapshot[] {
  try {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => parseSnapshot(JSON.stringify(entry))).filter((s): s is Snapshot => s !== null).slice(-50);
  } catch { return []; }
}
