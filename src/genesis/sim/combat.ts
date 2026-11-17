/**
 * Genesis — combat helpers. Pure TypeScript, no three/React/DOM.
 *
 * Melee hit detection and damage application live here so they can be tested
 * headless; the renderer only feeds positions and reads back results.
 */
export type Combatant = {
  hp: number;
  maxHp: number;
  ki: number;
  maxKi: number;
  alive: boolean;
};

export function createCombatant(hp = 100, ki = 100): Combatant {
  return { hp, maxHp: hp, ki, maxKi: ki, alive: true };
}

export const MELEE_RANGE = 1.25;
export const MELEE_DAMAGE = 10;
export const KI_BLAST_COST = 15;
export const KI_BLAST_DAMAGE = 18;
export const KI_BLAST_RANGE = 12;

/** Direction vector the attacker is facing (world XZ), length 1. */
export function facingVector(facing: number): { x: number; z: number } {
  return { x: Math.sin(facing), z: Math.cos(facing) };
}

/** Distance between two XZ positions. */
export function planarDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/**
 * A melee attack connects when the target is within MELEE_RANGE and roughly in
 * front of the attacker (dot >= 0.3, i.e. within ~72° of facing).
 */
export function meleeHits(
  attacker: { x: number; z: number; facing: number },
  target: { x: number; z: number },
  range = MELEE_RANGE,
): boolean {
  const d = planarDistance(attacker, target);
  if (d > range || d < 1e-6) return false;
  const v = facingVector(attacker.facing);
  const dx = (target.x - attacker.x) / d;
  const dz = (target.z - attacker.z) / d;
  return v.x * dx + v.z * dz >= 0.3;
}

export function applyDamage(target: Combatant, amount: number): Combatant {
  const hp = Math.max(0, target.hp - amount);
  return { ...target, hp, alive: hp > 0 };
}

export function spendKi(target: Combatant, amount: number): Combatant | null {
  if (target.ki < amount) return null;
  return { ...target, ki: target.ki - amount };
}

export function regenKi(target: Combatant, amount: number): Combatant {
  return { ...target, ki: Math.min(target.maxKi, target.ki + amount) };
}

export function kiBlastHits(
  origin: { x: number; z: number },
  target: { x: number; z: number },
  range = KI_BLAST_RANGE,
): boolean {
  return planarDistance(origin, target) <= range;
}
