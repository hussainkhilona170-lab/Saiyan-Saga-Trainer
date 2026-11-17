/**
 * Genesis — RPG progression. Pure TypeScript, no three/React/DOM.
 */
export type Progress = {
  level: number;
  xp: number;
};

export const BASE_XP_PER_LEVEL = 100;
export const XP_PER_MELEE_HIT = 5;
export const XP_PER_KI_HIT = 8;
export const XP_PER_KILL = 50;

/** XP required to advance from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return BASE_XP_PER_LEVEL * Math.max(1, level);
}

export function createProgress(): Progress {
  return { level: 1, xp: 0 };
}

/** Award XP and level up as many times as the accumulated XP allows.
 *  Returns the updated progress plus how many levels were gained. */
export function awardXp(p: Progress, amount: number): { progress: Progress; levelsGained: number } {
  const next = { ...p, xp: p.xp + Math.max(0, amount) };
  let gained = 0;
  while (next.xp >= xpToNextLevel(next.level)) {
    next.xp -= xpToNextLevel(next.level);
    next.level += 1;
    gained += 1;
  }
  return { progress: next, levelsGained: gained };
}

export function maxKiForLevel(level: number): number {
  return 100 + (Math.max(1, level) - 1) * 10;
}

export function maxHpForLevel(level: number): number {
  return 100 + (Math.max(1, level) - 1) * 15;
}
