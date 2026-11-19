/**
 * Genesis — enemy roster and chase/attack AI. Pure TypeScript: no three.js,
 * React or DOM, so the behaviours are headless-testable.
 *
 * Three archetypes: a baseline grunt, a fast/weak scout, and a slow/tanky
 * brute. Each one guards a home point, chases the player inside its aggro
 * radius, stops at its own attack range, and drifts home when disengaged.
 */

export type EnemyType = {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  /** Seconds between attacks. */
  attackInterval: number;
  /** Distance at which the enemy engages the player. */
  aggroRange: number;
  /** Distance it stops at to attack. */
  stopRange: number;
  /** Seconds before a defeated enemy respawns. */
  respawn: number;
  /** XP awarded for the defeating blow. */
  xp: number;
  color: string;
  radius: number;
  /** Capsule cylinder length (total height = length + 2 × radius). */
  height: number;
  home: { x: number; z: number };
};

export const ENEMY_TYPES: readonly EnemyType[] = [
  {
    id: "grunt",
    name: "Grunt",
    hp: 60,
    speed: 2.5,
    damage: 8,
    attackInterval: 1.2,
    aggroRange: 8,
    stopRange: 2,
    respawn: 4,
    xp: 50,
    color: "#7a3aa0",
    radius: 0.3,
    height: 0.9,
    home: { x: -4, z: 0 },
  },
  {
    id: "scout",
    name: "Scout",
    hp: 35,
    speed: 3.6,
    damage: 5,
    attackInterval: 0.9,
    aggroRange: 10,
    stopRange: 1.8,
    respawn: 3,
    xp: 35,
    color: "#3aa0a0",
    radius: 0.25,
    height: 0.8,
    home: { x: -10, z: -8 },
  },
  {
    id: "brute",
    name: "Brute",
    hp: 140,
    speed: 1.8,
    damage: 16,
    attackInterval: 1.8,
    aggroRange: 9,
    stopRange: 2.3,
    respawn: 6,
    xp: 110,
    color: "#b0533a",
    radius: 0.45,
    height: 1.2,
    home: { x: -16, z: 4 },
  },
];

/** dt clamp keeps a tab-out frame from teleporting an enemy. */
export const ENEMY_MAX_DT = 0.05;

export function enemySpawnY(def: EnemyType): number {
  return def.radius + def.height / 2;
}

export type EnemyTick = {
  x: number;
  z: number;
  cooldown: number;
  attack: boolean;
};

/**
 * One AI step. Engages when the player is alive and inside `aggroRange`,
 * closes to `stopRange`, attacks on cooldown, and returns home otherwise.
 */
export function stepEnemy(
  def: EnemyType,
  pos: { x: number; z: number },
  cooldown: number,
  player: { x: number; z: number; alive: boolean },
  rawDt: number,
): EnemyTick {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), ENEMY_MAX_DT) : 0;
  let cd = Number.isFinite(cooldown) ? Math.max(0, cooldown) : 0;
  let x = Number.isFinite(pos.x) ? pos.x : def.home.x;
  let z = Number.isFinite(pos.z) ? pos.z : def.home.z;
  cd = Math.max(0, cd - dt);

  const px = Number.isFinite(player.x) ? player.x : def.home.x;
  const pz = Number.isFinite(player.z) ? player.z : def.home.z;
  const dx = px - x;
  const dz = pz - z;
  const dist = Math.hypot(dx, dz);
  let attack = false;

  if (player.alive && dist <= def.aggroRange) {
    if (dist > def.stopRange && dist > 1e-6) {
      // Close only as far as the stop range, so a fast enemy cannot overshoot.
      const step = Math.min(def.speed * dt, dist - def.stopRange);
      x += (dx / dist) * step;
      z += (dz / dist) * step;
    }
    if (dist <= def.stopRange && cd <= 0) {
      attack = true;
      cd = def.attackInterval;
    }
  } else {
    const hx = def.home.x - x;
    const hz = def.home.z - z;
    const homeDist = Math.hypot(hx, hz);
    if (homeDist > 0.05) {
      const step = Math.min(def.speed * dt, homeDist);
      x += (hx / homeDist) * step;
      z += (hz / homeDist) * step;
    }
  }

  return { x, z, cooldown: cd, attack };
}
