/**
 * Genesis — save envelope. Pure serialization helpers; storage I/O lives in the
 * render layer so this module stays headless-testable.
 */
export const SAVE_VERSION = 1;
export const SAVE_KEY = "genesis.save";

export type GenesisSave = {
  version: number;
  level: number;
  xp: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  ki: number;
};

export function serializeSave(s: GenesisSave): string {
  return JSON.stringify(s);
}

export function parseSave(raw: string | null): GenesisSave | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<GenesisSave>;
    if (typeof v.version !== "number" || v.version !== SAVE_VERSION) return null;
    if (typeof v.level !== "number" || typeof v.xp !== "number") return null;
    return {
      version: v.version,
      level: Math.max(1, Math.floor(v.level)),
      xp: Math.max(0, v.xp),
      x: Number.isFinite(v.x) ? (v.x as number) : 0,
      y: Number.isFinite(v.y) ? (v.y as number) : 0,
      z: Number.isFinite(v.z) ? (v.z as number) : 0,
      hp: Number.isFinite(v.hp) ? (v.hp as number) : 100,
      ki: Number.isFinite(v.ki) ? (v.ki as number) : 100,
    };
  } catch {
    return null;
  }
}
