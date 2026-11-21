/**
 * Genesis — enemy archetypes, region spawn sets and chase/attack AI.
 * Pure TypeScript: no three.js, React or DOM, so the behaviours are
 * headless-testable.
 *
 * Three archetypes: a baseline grunt, a fast/weak scout, and a slow/tanky
 * brute. Each region owns a spawn set built from those archetypes, so the same
 * silhouette can appear in more than one place. Elites are per-spawn variants
 * with scaled stats, a gold identity and much better rewards. Each enemy guards
 * a home point, chases the player inside its aggro radius, stops at its own
 * attack range, and drifts home when disengaged.
 */

/** Silhouette / behaviour family. */
export type EnemyArchetype = "grunt" | "scout" | "brute";

export type EnemyType = {
  /** Unique spawn id (not the archetype id). */
  id: string;
  /** Silhouette / behaviour family. */
  archetype: EnemyArchetype;
  /** Region id this spawn belongs to. */
  region: string;
  /** Scaled-up variant with a gold ring and better rewards. */
  elite: boolean;
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
  /** Radius of the idle patrol loop around home (0 disables patrolling). */
  patrolRadius: number;
  /**
   * Distance from home at which a chase is abandoned. The enemy then returns
   * home and ignores the player until it arrives (a classic leash).
   */
  leashRange: number;
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

/**
 * Base stats and visuals for one archetype. Region spawns resolve these into a
 * full `EnemyType` with their own id, home and optional elite scaling.
 */
export type EnemyArchetypeDef = Omit<EnemyType, "id" | "region" | "elite" | "home">;

export const ENEMY_ARCHETYPES: readonly EnemyArchetypeDef[] = [
  {
    archetype: "grunt",
    name: "Grunt",
    hp: 60,
    speed: 2.5,
    damage: 8,
    attackInterval: 1.2,
    aggroRange: 8,
    stopRange: 2,
    patrolRadius: 2.2,
    leashRange: 11,
    respawn: 4,
    xp: 50,
    color: "#7a3aa0",
    radius: 0.3,
    height: 0.9,
  },
  {
    archetype: "scout",
    name: "Scout",
    hp: 35,
    speed: 3.6,
    damage: 5,
    attackInterval: 0.9,
    aggroRange: 10,
    stopRange: 1.8,
    patrolRadius: 3.4,
    leashRange: 13,
    respawn: 3,
    xp: 35,
    color: "#3aa0a0",
    radius: 0.25,
    height: 0.8,
  },
  {
    archetype: "brute",
    name: "Brute",
    hp: 140,
    speed: 1.8,
    damage: 16,
    attackInterval: 1.8,
    aggroRange: 9,
    stopRange: 2.3,
    patrolRadius: 1.6,
    leashRange: 12,
    respawn: 6,
    xp: 110,
    color: "#b0533a",
    radius: 0.45,
    height: 1.2,
  },
];

export function archetypeByID(id: EnemyArchetype): EnemyArchetypeDef | undefined {
  return ENEMY_ARCHETYPES.find((def) => def.archetype === id);
}

/** One authored spawn inside a region. */
export type EnemySpawnDef = {
  /** Unique across every region. */
  id: string;
  archetype: EnemyArchetype;
  /** Optional display name override (e.g. "Cinder Grunt"). */
  name?: string;
  x: number;
  z: number;
  elite?: boolean;
};

export type RegionDef = {
  id: string;
  name: string;
  /** Short flavour line shown next to the region name in the HUD. */
  subtitle: string;
  center: { x: number; z: number };
  /** Radius of the region's playable bowl. */
  radius: number;
  spawns: readonly EnemySpawnDef[];
};

/** Elite variants: tougher, slower, worth far more XP. */
export const ELITE_SCALE = {
  hp: 2.6,
  damage: 1.6,
  xp: 3,
  respawn: 8,
  speed: 0.92,
  radius: 1.18,
  height: 1.12,
  aggroRange: 1,
  leashRange: 2,
} as const;

/** Gold identity shared by every elite body and ring. */
export const ELITE_COLOR = "#d8a13a";

export const REGIONS: readonly RegionDef[] = [
  {
    id: "ridge",
    name: "Hollow Ridge",
    subtitle: "Training clearing",
    center: { x: 0, z: 0 },
    radius: 24,
    spawns: [
      { id: "grunt", archetype: "grunt", x: -4, z: 0 },
      { id: "scout", archetype: "scout", x: -10, z: -8 },
      { id: "brute", archetype: "brute", x: -16, z: 4 },
    ],
  },
  {
    id: "flats",
    name: "Ashen Flats",
    subtitle: "Elite territory",
    center: { x: 36, z: -28 },
    radius: 16,
    spawns: [
      {
        id: "cinder-grunt",
        archetype: "grunt",
        name: "Cinder Grunt",
        x: 30,
        z: -24,
      },
      {
        id: "cinder-scout",
        archetype: "scout",
        name: "Cinder Scout",
        x: 42,
        z: -32,
      },
      {
        id: "cinder-brute",
        archetype: "brute",
        name: "Cinder Brute",
        x: 34,
        z: -20,
      },
      {
        id: "elite-scout",
        archetype: "scout",
        name: "Elite Stalker",
        x: 44,
        z: -26,
        elite: true,
      },
      {
        id: "elite-brute",
        archetype: "brute",
        name: "Elite Warden",
        x: 30,
        z: -36,
        elite: true,
      },
    ],
  },
];

function resolveSpawn(spawn: EnemySpawnDef, region: RegionDef): EnemyType {
  const base = archetypeByID(spawn.archetype);
  if (!base) throw new Error(`Unknown enemy archetype: ${spawn.archetype}`);
  const elite = spawn.elite === true;
  const scale = elite ? ELITE_SCALE : null;
  return {
    id: spawn.id,
    archetype: base.archetype,
    region: region.id,
    elite,
    name: spawn.name ?? (elite ? `Elite ${base.name}` : base.name),
    hp: Math.round(base.hp * (scale?.hp ?? 1)),
    speed: base.speed * (scale?.speed ?? 1),
    damage: Math.round(base.damage * (scale?.damage ?? 1)),
    attackInterval: base.attackInterval,
    aggroRange: base.aggroRange + (scale?.aggroRange ?? 0),
    stopRange: base.stopRange,
    patrolRadius: base.patrolRadius,
    leashRange: base.leashRange + (scale?.leashRange ?? 0),
    respawn: scale?.respawn ?? base.respawn,
    xp: Math.round(base.xp * (scale?.xp ?? 1)),
    color: elite ? ELITE_COLOR : base.color,
    radius: base.radius * (scale?.radius ?? 1),
    height: base.height * (scale?.height ?? 1),
    home: { x: spawn.x, z: spawn.z },
  };
}

/** Every spawn in every region, resolved to full enemy definitions. */
export const ENEMY_TYPES: readonly EnemyType[] = REGIONS.flatMap((region) =>
  region.spawns.map((spawn) => resolveSpawn(spawn, region)),
);

export function regionByID(id: string): RegionDef | undefined {
  return REGIONS.find((region) => region.id === id);
}

/**
 * The region the player is standing in. A containing region always wins;
 * outside every bowl the nearest centre is used, so the HUD never goes blank.
 * Non-finite positions fall back to the first region.
 */
export function regionAt(pos: { x: number; z: number }): RegionDef {
  const fallback = REGIONS[0]!;
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return fallback;
  let best = fallback;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const region of REGIONS) {
    const distance = Math.hypot(region.center.x - pos.x, region.center.z - pos.z);
    // 0–1 inside a bowl, >1 outside, so containment always beats proximity.
    const score = distance <= region.radius ? distance / region.radius : 1 + distance / region.radius;
    if (score < bestScore) {
      bestScore = score;
      best = region;
    }
  }
  return best;
}

/** dt clamp keeps a tab-out frame from teleporting an enemy. */
export const ENEMY_MAX_DT = 0.05;

export function enemySpawnY(def: EnemyType): number {
  return def.radius + def.height / 2;
}

/**
 * What an enemy is doing right now:
 * - `chase`  — engaged with the player inside aggro range and inside its leash
 * - `return` — walking back home after losing the player or being leashed
 * - `patrol` — idling around its home point, waiting for the player
 */
export type EnemyMode = "chase" | "return" | "patrol";

export type EnemyAiState = {
  mode: EnemyMode;
  /** Angle on the patrol loop, in radians. */
  patrolPhase: number;
};

export const ENEMY_IDLE_STATE: EnemyAiState = { mode: "patrol", patrolPhase: 0 };

/** Idle patrol moves at a fraction of combat speed. */
const PATROL_SPEED_FACTOR = 0.35;
/** Distance from home considered "arrived". */
const HOME_ARRIVE = 0.15;

export type EnemyTick = {
  x: number;
  z: number;
  cooldown: number;
  attack: boolean;
  mode: EnemyMode;
  patrolPhase: number;
};

/**
 * One AI step. States hand off like this:
 *
 *   patrol ──player inside aggro──▶ chase
 *   chase  ──player escapes / leash broken──▶ return
 *   return ──arrives home──▶ patrol (or chase if the player is right there)
 *
 * `return` is sticky while the enemy is away from home, so a leashed enemy
 * cannot be re-aggroed across the arena; it gives up, walks back and resets.
 */
export function stepEnemy(
  def: EnemyType,
  pos: { x: number; z: number },
  cooldown: number,
  player: { x: number; z: number; alive: boolean },
  rawDt: number,
  state: EnemyAiState = ENEMY_IDLE_STATE,
): EnemyTick {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), ENEMY_MAX_DT) : 0;
  let cd = Number.isFinite(cooldown) ? Math.max(0, cooldown) : 0;
  let x = Number.isFinite(pos.x) ? pos.x : def.home.x;
  let z = Number.isFinite(pos.z) ? pos.z : def.home.z;
  let patrolPhase = Number.isFinite(state.patrolPhase) ? state.patrolPhase : 0;
  cd = Math.max(0, cd - dt);

  const px = Number.isFinite(player.x) ? player.x : def.home.x;
  const pz = Number.isFinite(player.z) ? player.z : def.home.z;
  const dx = px - x;
  const dz = pz - z;
  const dist = Math.hypot(dx, dz);
  const homeDist = Math.hypot(def.home.x - x, def.home.z - z);

  let mode: EnemyMode = "return";
  if (!player.alive) {
    // A dead player pauses the arena: hold position, keep counting down.
    mode = "return";
  } else if (state.mode === "return" && homeDist > HOME_ARRIVE) {
    // Give-up is sticky until the enemy is back home.
    mode = "return";
  } else if (homeDist <= def.leashRange && dist <= def.aggroRange) {
    mode = "chase";
  } else if (def.patrolRadius > 0 && homeDist <= def.patrolRadius + 0.25) {
    mode = "patrol";
  }

  let attack = false;

  if (mode === "chase") {
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
  } else if (mode === "patrol") {
    const radius = def.patrolRadius;
    const patrolSpeed = Math.max(0.2, def.speed * PATROL_SPEED_FACTOR);
    const tx = def.home.x + Math.sin(patrolPhase) * radius;
    const tz = def.home.z + Math.cos(patrolPhase) * radius;
    const tdx = tx - x;
    const tdz = tz - z;
    const targetDist = Math.hypot(tdx, tdz);
    if (targetDist > 1e-6) {
      const step = Math.min(patrolSpeed * dt, targetDist);
      x += (tdx / targetDist) * step;
      z += (tdz / targetDist) * step;
    }
    patrolPhase = (patrolPhase + (patrolSpeed / radius) * dt) % (Math.PI * 2);
  } else {
    const hx = def.home.x - x;
    const hz = def.home.z - z;
    if (homeDist > HOME_ARRIVE) {
      const step = Math.min(def.speed * dt, homeDist);
      x += (hx / homeDist) * step;
      z += (hz / homeDist) * step;
    }
  }

  return { x, z, cooldown: cd, attack, mode, patrolPhase };
}
