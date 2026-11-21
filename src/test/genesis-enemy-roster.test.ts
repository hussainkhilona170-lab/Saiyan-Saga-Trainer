import { describe, expect, it } from "vitest";
import { ENEMY_TYPES } from "../genesis/sim/enemies";
import {
  countAliveEnemies,
  countEnemiesInRegion,
  createEnemyRoster,
  damageEnemy,
  enemyDefByID,
  killAllEnemies,
  stepEnemyRoster,
  telegraphStrength,
  type EnemyRoster,
} from "../genesis/sim/enemyRoster";

const grunt = ENEMY_TYPES.find((e) => e.id === "grunt")!;
const scout = ENEMY_TYPES.find((e) => e.id === "scout")!;
const brute = ENEMY_TYPES.find((e) => e.id === "brute")!;
const alivePlayer = (x: number, z: number) => ({ x, z, alive: true });

/** Advance the roster in fixed small steps, like real frames. */
function advance(
  roster: EnemyRoster,
  player: { x: number; z: number; alive: boolean },
  seconds: number,
) {
  let current = roster;
  const attacks: string[] = [];
  const step = 0.05;
  for (let t = 0; t < seconds - 1e-9; t += step) {
    const result = stepEnemyRoster(current, player, step);
    current = result.roster;
    attacks.push(...result.attacks.map((a) => a.typeId));
  }
  return { roster: current, attacks };
}

describe("Genesis enemy roster state", () => {
  it("spawns one live instance per authored spawn at its home point", () => {
    const roster = createEnemyRoster();
    expect(roster).toHaveLength(ENEMY_TYPES.length);
    expect(roster.map((e) => e.typeId)).toEqual(ENEMY_TYPES.map((e) => e.id));
    for (const enemy of roster) {
      const def = enemyDefByID(enemy.typeId)!;
      expect(enemy).toMatchObject({
        x: def.home.x,
        z: def.home.z,
        hp: def.hp,
        alive: true,
        cooldown: 0,
        respawnTimer: 0,
      });
    }
    expect(countAliveEnemies(roster)).toBe(ENEMY_TYPES.length);
  });

  it("keeps duplicate archetypes independent and counts per region", () => {
    const roster = createEnemyRoster();
    const ridgeGrunt = enemyDefByID("grunt")!;
    const cinderGrunt = enemyDefByID("cinder-grunt")!;
    expect(cinderGrunt.archetype).toBe(ridgeGrunt.archetype);

    const hit = damageEnemy(roster, "cinder-grunt", cinderGrunt.hp / 2);
    expect(hit.roster.find((e) => e.typeId === "cinder-grunt")!.hp).toBe(cinderGrunt.hp / 2);
    expect(hit.roster.find((e) => e.typeId === "grunt")!.hp).toBe(ridgeGrunt.hp);

    const ridge = countEnemiesInRegion(roster, "ridge");
    const flats = countEnemiesInRegion(roster, "flats");
    expect(ridge).toEqual({ alive: 3, total: 3 });
    expect(flats).toEqual({ alive: 5, total: 5 });
    expect(ridge.alive + flats.alive).toBe(ENEMY_TYPES.length);
    expect(countEnemiesInRegion(roster, "missing")).toEqual({ alive: 0, total: 0 });
  });

  it("only the engaged archetype closes in and attacks", () => {
    const roster = createEnemyRoster();
    const player = alivePlayer(grunt.home.x + 1, grunt.home.z);
    const { roster: next, attacks } = stepEnemyRoster(roster, player, 0.05);
    const gruntNow = next.find((e) => e.typeId === grunt.id)!;
    const scoutNow = next.find((e) => e.typeId === scout.id)!;
    expect(gruntNow.cooldown).toBe(grunt.attackInterval);
    expect(gruntNow.mode).toBe("chase");
    expect(attacks).toEqual([
      { typeId: grunt.id, damage: grunt.damage, x: grunt.home.x, z: grunt.home.z },
    ]);
    // The others stay on their patrol and never swing.
    expect(scoutNow.mode).toBe("patrol");
    expect(scoutNow.cooldown).toBe(0);
  });

  it("grants the attack token to the closest enemy only", () => {
    // Stack every enemy next to the player so all three want to swing.
    const roster = createEnemyRoster().map((enemy) => ({ ...enemy, x: 0, z: 0 }));
    const player = alivePlayer(0.5, 0);

    const first = stepEnemyRoster(roster, player, 0.05);
    expect(first.attacks).toHaveLength(1);
    const granted = first.attacks[0]!.typeId;

    // The two that were held back keep a zero cooldown, so one of them swings
    // once the token is free again.
    for (const enemy of first.roster) {
      if (enemy.typeId === granted) continue;
      expect(enemy.cooldown).toBe(0);
    }

    const second = stepEnemyRoster(first.roster, player, 0.05);
    expect(second.attacks).toHaveLength(1);
    expect(second.attacks[0]!.typeId).not.toBe(granted);
  });

  it("patrols around home while the player is away", () => {
    const farAway = alivePlayer(60, 60);
    const start = createEnemyRoster();
    const { roster } = advance(start, farAway, 2);
    for (const enemy of roster) {
      const def = enemyDefByID(enemy.typeId)!;
      const fromHome = Math.hypot(enemy.x - def.home.x, enemy.z - def.home.z);
      expect(enemy.mode).toBe("patrol");
      expect(fromHome).toBeGreaterThan(0.05);
      expect(fromHome).toBeLessThanOrEqual(def.patrolRadius + 0.3);
    }
  });

  it("leashes: gives up the chase and walks home even with the player nearby", () => {
    const gruntLeashed = createEnemyRoster().map((enemy) =>
      enemy.typeId === grunt.id
        ? {
            ...enemy,
            x: grunt.home.x + grunt.leashRange + 0.2,
            z: grunt.home.z,
            mode: "chase" as const,
          }
        : enemy,
    );
    // The player stands right next to the grunt but is outside the leash.
    const player = alivePlayer(grunt.home.x + grunt.leashRange - 4, grunt.home.z);
    const first = stepEnemyRoster(gruntLeashed, player, 0.05);
    const leashed = first.roster.find((e) => e.typeId === grunt.id)!;
    expect(leashed.mode).toBe("return");
    expect(leashed.x).toBeLessThan(grunt.home.x + grunt.leashRange + 0.2);
    expect(first.attacks).toHaveLength(0);

    // Sticky: still returning next frame even though the player is close.
    const second = stepEnemyRoster(first.roster, player, 0.05);
    const still = second.roster.find((e) => e.typeId === grunt.id)!;
    expect(still.mode).toBe("return");
    expect(still.x).toBeLessThan(leashed.x);
  });

  it("respawns a defeated enemy on its own timer, at home with full HP", () => {
    const dead = damageEnemy(createEnemyRoster(), grunt.id, grunt.hp);
    expect(dead.killed).toBe(true);
    expect(countAliveEnemies(dead.roster)).toBe(ENEMY_TYPES.length - 1);
    expect(dead.roster.find((e) => e.typeId === grunt.id)).toMatchObject({
      hp: 0,
      alive: false,
      respawnTimer: grunt.respawn,
    });

    const farAway = alivePlayer(40, 40);
    const early = advance(dead.roster, farAway, grunt.respawn - 0.2);
    expect(early.roster.find((e) => e.typeId === grunt.id)!.alive).toBe(false);
    expect(countAliveEnemies(early.roster)).toBe(ENEMY_TYPES.length - 1);

    const late = advance(early.roster, farAway, 0.3);
    const respawned = late.roster.find((e) => e.typeId === grunt.id)!;
    expect(respawned).toMatchObject({
      alive: true,
      hp: grunt.hp,
      respawnTimer: 0,
    });
    // It comes back at home, then resumes its idle patrol there.
    const fromHome = Math.hypot(respawned.x - grunt.home.x, respawned.z - grunt.home.z);
    expect(fromHome).toBeLessThanOrEqual(grunt.patrolRadius + 0.3);
  });

  it("returns a defeated enemy exactly at home on the respawn frame", () => {
    const dead = damageEnemy(createEnemyRoster(), grunt.id, grunt.hp).roster.map((enemy) =>
      enemy.typeId === grunt.id ? { ...enemy, respawnTimer: 0 } : enemy,
    );
    const { roster } = stepEnemyRoster(dead, alivePlayer(60, 60), 0.05);
    expect(roster.find((e) => e.typeId === grunt.id)).toMatchObject({
      alive: true,
      hp: grunt.hp,
      x: grunt.home.x,
      z: grunt.home.z,
      mode: "patrol",
      patrolPhase: 0,
    });
  });

  it("reports a kill only on the alive → dead transition", () => {
    let roster = createEnemyRoster();
    const first = damageEnemy(roster, brute.id, brute.hp / 2);
    roster = first.roster;
    expect(first.killed).toBe(false);
    expect(roster.find((e) => e.typeId === brute.id)).toMatchObject({
      hp: brute.hp / 2,
      alive: true,
    });

    const second = damageEnemy(roster, brute.id, brute.hp);
    roster = second.roster;
    expect(second.killed).toBe(true);
    expect(roster.find((e) => e.typeId === brute.id)).toMatchObject({ hp: 0, alive: false });

    const third = damageEnemy(roster, brute.id, 999);
    expect(third.killed).toBe(false);
    expect(third.roster.find((e) => e.typeId === brute.id)!.hp).toBe(0);
  });

  it("guards invalid damage and unknown type ids", () => {
    const roster = createEnemyRoster();
    expect(damageEnemy(roster, grunt.id, Number.NaN).roster).toEqual(roster);
    expect(damageEnemy(roster, grunt.id, -5).roster).toEqual(roster);
    expect(damageEnemy(roster, "missing", 10).roster).toEqual(roster);
    expect(damageEnemy(roster, grunt.id, 0).killed).toBe(false);
  });

  it("kills every living enemy and counts only living ones", () => {
    const partial = damageEnemy(createEnemyRoster(), scout.id, scout.hp).roster;
    const all = killAllEnemies(partial);
    expect(all.killed).toBe(ENEMY_TYPES.length - 1);
    expect(countAliveEnemies(all.roster)).toBe(0);
    for (const enemy of all.roster) {
      expect(enemy.alive).toBe(false);
      const def = enemyDefByID(enemy.typeId)!;
      expect(enemy.respawnTimer).toBe(def.respawn);
    }
    expect(killAllEnemies(all.roster).killed).toBe(0);
  });
});

describe("Genesis attack telegraph", () => {
  it("stays dark until the cooldown enters the warning window", () => {
    expect(telegraphStrength(grunt.attackInterval)).toBe(0);
    expect(telegraphStrength(0.35)).toBe(0);
    expect(telegraphStrength(0.2)).toBeGreaterThan(0);
  });

  it("rises to full strength as the strike lands", () => {
    expect(telegraphStrength(0.175)).toBeCloseTo(0.5, 6);
    expect(telegraphStrength(0)).toBe(1);
    expect(telegraphStrength(-1)).toBe(1);
  });

  it("guards non-finite values and invalid windows", () => {
    expect(telegraphStrength(Number.NaN)).toBe(0);
    expect(telegraphStrength(0.1, 0)).toBe(0);
    expect(telegraphStrength(0.1, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
