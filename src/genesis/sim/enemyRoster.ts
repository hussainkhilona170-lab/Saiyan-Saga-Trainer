/**
 * Genesis — live enemy roster state. Pure TypeScript: no three.js, React or DOM.
 *
 * `enemies.ts` describes the archetypes and one AI step. This module owns the
 * per-enemy state that a scene needs: position, HP, attack cooldown and respawn
 * timer. Keeping it pure means the respawn/cooldown rules are headless-testable
 * while the renderer only mirrors the returned state onto meshes.
 */
import { ENEMY_MAX_DT, ENEMY_TYPES, stepEnemy, type EnemyMode, type EnemyType } from "./enemies";

export type EnemyInstance = {
  /** Matches `EnemyType.id`; one instance per archetype. */
  typeId: string;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
  /** Seconds until the next attack. */
  cooldown: number;
  /** Seconds until this defeated enemy comes back. */
  respawnTimer: number;
  /** Current AI mode, mirrored from `stepEnemy`. */
  mode: EnemyMode;
  /** Angle on the patrol loop, in radians. */
  patrolPhase: number;
};

export type EnemyRoster = EnemyInstance[];

export type EnemyAttack = {
  typeId: string;
  damage: number;
  x: number;
  z: number;
};

export function enemyDefByID(id: string): EnemyType | undefined {
  return ENEMY_TYPES.find((def) => def.id === id);
}

/** One live instance per archetype, spawned at its home point. */
export function createEnemyRoster(): EnemyRoster {
  return ENEMY_TYPES.map((def) => ({
    typeId: def.id,
    x: def.home.x,
    z: def.home.z,
    hp: def.hp,
    alive: true,
    cooldown: 0,
    respawnTimer: 0,
    mode: "patrol",
    patrolPhase: 0,
  }));
}

export function countAliveEnemies(roster: EnemyRoster): number {
  let alive = 0;
  for (const enemy of roster) if (enemy.alive) alive += 1;
  return alive;
}

/** Seconds of warning before an enemy's next strike. */
export const ATTACK_TELEGRAPH = 0.35;

/**
 * 0 → no warning, 1 → the strike lands now. Used by the renderer to pulse the
 * chest core during the last fraction of the attack cooldown. Pure so the
 * timing is testable and never drifts into the rules layer.
 */
export function telegraphStrength(cooldown: number, window = ATTACK_TELEGRAPH): number {
  if (!Number.isFinite(cooldown) || !Number.isFinite(window) || window <= 0) return 0;
  if (cooldown <= 0) return 1;
  if (cooldown >= window) return 0;
  return 1 - cooldown / window;
}

/**
 * Advance every enemy by one frame: patrol/chase/attack when alive, count down
 * the respawn timer when dead. Defeated enemies return at their home point with
 * full HP once their own timer expires — each archetype keeps its own clock.
 *
 * **Attack token** — only the living enemy closest to the player may land a
 * strike in a given frame. The others keep their cooldown at the pre-frame
 * value, so a swarm cannot delete the player in one tick and each enemy still
 * attacks on its own schedule.
 */
export function stepEnemyRoster(
  roster: EnemyRoster,
  player: { x: number; z: number; alive: boolean },
  rawDt: number,
): { roster: EnemyRoster; attacks: EnemyAttack[] } {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), ENEMY_MAX_DT) : 0;
  const px = Number.isFinite(player.x) ? player.x : 0;
  const pz = Number.isFinite(player.z) ? player.z : 0;

  type Staged = {
    enemy: EnemyInstance;
    def: EnemyType;
    tick: ReturnType<typeof stepEnemy>;
  };
  const staged: Staged[] = [];
  for (const enemy of roster) {
    const def = enemyDefByID(enemy.typeId);
    if (!def) continue;
    if (!enemy.alive) continue;
    staged.push({
      enemy,
      def,
      tick: stepEnemy(def, enemy, enemy.cooldown, player, dt, {
        mode: enemy.mode,
        patrolPhase: enemy.patrolPhase,
      }),
    });
  }

  // Only the closest living attacker swings this frame.
  let tokenIndex = -1;
  let tokenDistance = Number.POSITIVE_INFINITY;
  staged.forEach((entry, index) => {
    if (!entry.tick.attack) return;
    const distance = Math.hypot(entry.tick.x - px, entry.tick.z - pz);
    if (distance < tokenDistance) {
      tokenDistance = distance;
      tokenIndex = index;
    }
  });

  const attacks: EnemyAttack[] = [];
  const byType = new Map(staged.map((entry) => [entry.enemy.typeId, entry]));
  const tokenTypeId = tokenIndex >= 0 ? staged[tokenIndex]!.enemy.typeId : null;
  const next: EnemyRoster = roster.map((enemy) => {
    const def = enemyDefByID(enemy.typeId);
    if (!def) return enemy;

    if (!enemy.alive) {
      const respawnTimer = Math.max(0, enemy.respawnTimer - dt);
      if (respawnTimer > 0 || dt <= 0) return { ...enemy, respawnTimer };
      return {
        ...enemy,
        x: def.home.x,
        z: def.home.z,
        hp: def.hp,
        alive: true,
        cooldown: 0,
        respawnTimer: 0,
        mode: "patrol",
        patrolPhase: 0,
      };
    }

    const entry = byType.get(enemy.typeId);
    if (!entry) return enemy;
    const tick = entry.tick;

    if (tick.attack && enemy.typeId === tokenTypeId) {
      attacks.push({ typeId: enemy.typeId, damage: def.damage, x: tick.x, z: tick.z });
      return {
        ...enemy,
        x: tick.x,
        z: tick.z,
        cooldown: tick.cooldown,
        mode: tick.mode,
        patrolPhase: tick.patrolPhase,
      };
    }

    // Held back by the attack token: undo the cooldown reset so the enemy
    // swings as soon as it next wins the token.
    return {
      ...enemy,
      x: tick.x,
      z: tick.z,
      cooldown: Math.max(0, enemy.cooldown - dt),
      mode: tick.mode,
      patrolPhase: tick.patrolPhase,
    };
  });

  return { roster: next, attacks };
}

/**
 * Apply damage to one enemy. Returns `killed: true` only on the transition from
 * alive to dead, so callers award kill XP exactly once.
 */
export function damageEnemy(
  roster: EnemyRoster,
  typeId: string,
  amount: number,
): { roster: EnemyRoster; killed: boolean } {
  const damage = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  let killed = false;
  const next = roster.map((enemy) => {
    if (enemy.typeId !== typeId || !enemy.alive || damage <= 0) return enemy;
    const hp = Math.max(0, enemy.hp - damage);
    if (hp > 0) return { ...enemy, hp };
    const def = enemyDefByID(typeId);
    killed = true;
    return {
      ...enemy,
      hp: 0,
      alive: false,
      cooldown: 0,
      respawnTimer: def?.respawn ?? 0,
      mode: "return" as const,
      patrolPhase: 0,
    };
  });
  return { roster: next, killed };
}

/** Defeat every living enemy (God Engine `killEnemies`). */
export function killAllEnemies(roster: EnemyRoster): { roster: EnemyRoster; killed: number } {
  let killed = 0;
  const next = roster.map((enemy) => {
    if (!enemy.alive) return enemy;
    const def = enemyDefByID(enemy.typeId);
    killed += 1;
    return {
      ...enemy,
      hp: 0,
      alive: false,
      cooldown: 0,
      respawnTimer: def?.respawn ?? 0,
      mode: "return" as const,
      patrolPhase: 0,
    };
  });
  return { roster: next, killed };
}
