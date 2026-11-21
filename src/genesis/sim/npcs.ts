/**
 * Genesis — non-combat NPCs. Pure TypeScript: no three.js, React or DOM.
 *
 * One mentor stands near the spawn point. He does not fight; he exists so the
 * world has a friendly face and a place to explain the next objective. All
 * interaction rules (range, cycling dialogue, facing) live here so they are
 * headless-testable and the renderer only mirrors them.
 */

export type NpcDef = {
  id: string;
  name: string;
  role: string;
  /** World position (y is ground level; the renderer grounds the body). */
  x: number;
  z: number;
  /** Yaw the NPC faces while nobody is talking to it (radians). */
  yaw: number;
  /** Lines cycled in order each time the player interacts. */
  lines: readonly string[];
  /** Robe colour, theme-token friendly. */
  robe: string;
  /** Trim / staff colour. */
  accent: string;
};

/** Distance at which the interact prompt appears. */
export const NPC_INTERACT_RANGE = 2.6;

export const GENESIS_NPCS: readonly NpcDef[] = [
  {
    id: "oren",
    name: "Master Oren",
    role: "Elder of the Hollow Ridge",
    x: 5,
    z: 7,
    yaw: Math.PI,
    robe: "#3f4f8a",
    accent: "#e8d9a8",
    lines: [
      "So you are the one making all that noise. Good — the ridge has been quiet for too long.",
      "Three of them guard this clearing: a grunt, a scout, and a brute. Pull one at a time.",
      "The brute hits hardest but turns slowest. Circle it and strike from behind.",
      "East of here the Ashen Flats burn. Their kin are stronger, and two carry the gold mark of elites.",
      "Something larger waits past the far pillars. Do not wake it until you are ready.",
    ],
  },
];

export function npcByID(id: string): NpcDef | undefined {
  return GENESIS_NPCS.find((npc) => npc.id === id);
}

export type NpcProximity = {
  npc: NpcDef;
  distance: number;
};

/**
 * The closest NPC within `range`, or null. Ties resolve in roster order so the
 * result is deterministic.
 */
export function nearestNpc(
  pos: { x: number; z: number },
  range: number = NPC_INTERACT_RANGE,
  npcs: readonly NpcDef[] = GENESIS_NPCS,
): NpcProximity | null {
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return null;
  const limit = Number.isFinite(range) && range > 0 ? range : NPC_INTERACT_RANGE;
  let best: NpcProximity | null = null;
  for (const npc of npcs) {
    const distance = Math.hypot(npc.x - pos.x, npc.z - pos.z);
    if (distance > limit) continue;
    if (!best || distance < best.distance) best = { npc, distance };
  }
  return best;
}

/** Advance to the next line, wrapping. Guards an empty/absent line list. */
export function nextLineIndex(current: number, lineCount: number): number {
  if (!Number.isFinite(lineCount) || lineCount <= 0) return 0;
  if (!Number.isFinite(current) || current < 0) return 0;
  return (Math.floor(current) + 1) % Math.floor(lineCount);
}

/** The line at `index`, wrapped and guarded. */
export function dialogueLine(npc: NpcDef, index: number): string {
  const lines = npc.lines;
  if (lines.length === 0) return "";
  if (!Number.isFinite(index) || index < 0) return lines[0]!;
  return lines[Math.floor(index) % lines.length]!;
}

/**
 * The yaw the NPC should hold: it turns to face the player while they are close
 * enough to talk, and otherwise keeps its authored idle yaw.
 */
export function npcFacingYaw(
  npc: NpcDef,
  pos: { x: number; z: number } | null,
  range: number = NPC_INTERACT_RANGE,
): number {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return npc.yaw;
  const dx = pos.x - npc.x;
  const dz = pos.z - npc.z;
  if (Math.hypot(dx, dz) > range) return npc.yaw;
  return Math.atan2(dx, dz);
}
