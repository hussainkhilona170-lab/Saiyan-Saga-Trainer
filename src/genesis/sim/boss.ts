/**
 * Genesis — boss encounter rules. Pure TypeScript: no three.js, React or DOM.
 *
 * The boss guards a home point and stays dormant until the player walks into
 * its aggro radius. Once awake it chases and attacks; dragging it too far from
 * home breaks the fight and it walks back before it can be re-aggroed. This
 * keeps a 300 HP boss from chasing a level-1 player across the whole map (and
 * out of its region) the moment the scene loads.
 */

export const BOSS_MAX_HP = 300;
export const BOSS_HOME = { x: 8, z: -6 } as const;
/** CapsuleGeometry(0.5, 1.4) centre height, so the feet sit on the ground. */
export const BOSS_SPAWN_Y = 1.2;
export const BOSS_AGGRO_RANGE = 7;
export const BOSS_LEASH_RANGE = 20;
export const BOSS_SPEED = 3;
export const BOSS_ATTACK_RANGE = 2.5;
export const BOSS_ATTACK_DAMAGE = 20;
export const BOSS_ATTACK_INTERVAL = 1.5;
export const BOSS_RESPAWN = 30;
/** Same tab-out clamp as the enemy roster. */
export const BOSS_MAX_DT = 0.05;

const HOME_ARRIVE = 0.2;

/**
 * - `idle`   — dormant at home, waiting for the player to enter aggro range
 * - `chase`  — awake, closing in and attacking
 * - `return` — gave up (leash or dead player) and walking home; sticky
 */
export type BossMode = "idle" | "chase" | "return";

export type BossAiState = {
  x: number;
  z: number;
  /** Seconds until the next strike. */
  cooldown: number;
  mode: BossMode;
};

export type BossTick = BossAiState & { attack: boolean };

export function createBossState(): BossAiState {
  return { x: BOSS_HOME.x, z: BOSS_HOME.z, cooldown: 0, mode: "idle" };
}

/** God Engine "spawnBoss" wakes the boss immediately. */
export function engageBoss(state: BossAiState = createBossState()): BossAiState {
  return { ...state, mode: "chase" };
}

export function stepBoss(
  state: BossAiState,
  player: { x: number; z: number; alive: boolean },
  rawDt: number,
): BossTick {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), BOSS_MAX_DT) : 0;
  let x = Number.isFinite(state.x) ? state.x : BOSS_HOME.x;
  let z = Number.isFinite(state.z) ? state.z : BOSS_HOME.z;
  let cooldown = Number.isFinite(state.cooldown) ? Math.max(0, state.cooldown) : 0;
  let mode: BossMode =
    state.mode === "chase" || state.mode === "return" ? state.mode : "idle";
  cooldown = Math.max(0, cooldown - dt);

  const px = Number.isFinite(player.x) ? player.x : BOSS_HOME.x;
  const pz = Number.isFinite(player.z) ? player.z : BOSS_HOME.z;
  const dx = px - x;
  const dz = pz - z;
  const dist = Math.hypot(dx, dz);
  const homeDist = Math.hypot(BOSS_HOME.x - x, BOSS_HOME.z - z);

  if (!player.alive) {
    // A dead player ends the encounter; the boss resets to its guard post.
    mode = "return";
  } else if (mode === "chase" && homeDist > BOSS_LEASH_RANGE) {
    mode = "return";
  } else if (mode === "idle" && homeDist <= BOSS_LEASH_RANGE && dist <= BOSS_AGGRO_RANGE) {
    mode = "chase";
  } else if (mode === "return" && homeDist <= HOME_ARRIVE) {
    mode = "idle";
  }

  let attack = false;
  if (mode === "chase") {
    if (dist > BOSS_ATTACK_RANGE && dist > 1e-6) {
      const step = Math.min(BOSS_SPEED * dt, dist - BOSS_ATTACK_RANGE);
      x += (dx / dist) * step;
      z += (dz / dist) * step;
    }
    if (dist <= BOSS_ATTACK_RANGE && cooldown <= 0) {
      attack = true;
      cooldown = BOSS_ATTACK_INTERVAL;
    }
  } else if (mode === "return") {
    if (homeDist > HOME_ARRIVE) {
      const step = Math.min(BOSS_SPEED * dt, homeDist);
      x += ((BOSS_HOME.x - x) / homeDist) * step;
      z += ((BOSS_HOME.z - z) / homeDist) * step;
    }
  }

  return { x, z, cooldown, mode, attack };
}
