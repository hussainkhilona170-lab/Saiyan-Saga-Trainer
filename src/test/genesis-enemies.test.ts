import { describe, expect, it } from "vitest";
import {
  ENEMY_MAX_DT,
  ENEMY_TYPES,
  enemySpawnY,
  stepEnemy,
  type EnemyType,
} from "../genesis/sim/enemies";

const grunt = ENEMY_TYPES.find((e) => e.id === "grunt")!;
const scout = ENEMY_TYPES.find((e) => e.id === "scout")!;
const brute = ENEMY_TYPES.find((e) => e.id === "brute")!;
const playerAlive = (x: number, z: number) => ({ x, z, alive: true });

function atHome(e: EnemyType) {
  return { x: e.home.x, z: e.home.z };
}

describe("Genesis enemy roster", () => {
  it("ships three distinct archetypes with valid stats", () => {
    expect(ENEMY_TYPES).toHaveLength(3);
    expect(new Set(ENEMY_TYPES.map((e) => e.id)).size).toBe(3);
    for (const e of ENEMY_TYPES) {
      expect(e.hp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.damage).toBeGreaterThan(0);
      expect(e.attackInterval).toBeGreaterThan(0);
      expect(e.aggroRange).toBeGreaterThan(e.stopRange);
      expect(e.respawn).toBeGreaterThan(0);
      expect(e.xp).toBeGreaterThan(0);
      expect(enemySpawnY(e)).toBeGreaterThan(0);
    }
  });

  it("gives each archetype its own home and identity", () => {
    expect(new Set(ENEMY_TYPES.map((e) => `${e.home.x},${e.home.z}`)).size).toBe(3);
    expect(scout.speed).toBeGreaterThan(grunt.speed);
    expect(brute.hp).toBeGreaterThan(grunt.hp);
    expect(brute.damage).toBeGreaterThan(grunt.damage);
  });
});

describe("Genesis enemy AI", () => {
  it("chases a player inside its aggro radius", () => {
    const p = atHome(grunt);
    const next = stepEnemy(grunt, p, 0, playerAlive(p.x + 5, p.z), ENEMY_MAX_DT);
    expect(next.x).toBeGreaterThan(p.x);
    expect(next.x).toBeCloseTo(p.x + grunt.speed * ENEMY_MAX_DT, 6);
    expect(next.z).toBeCloseTo(p.z, 6);
    expect(next.attack).toBe(false);
  });

  it("closes only to the stop range", () => {
    const p = atHome(grunt);
    // 2.05 m away: one full step would overshoot the 2 m stop range.
    const next = stepEnemy(grunt, p, 0, playerAlive(p.x + 2.05, p.z), ENEMY_MAX_DT);
    expect(next.x - p.x).toBeCloseTo(0.05, 6);
    expect(next.attack).toBe(false);
  });

  it("attacks on cooldown inside its range", () => {
    const p = atHome(grunt);
    const first = stepEnemy(grunt, p, 0, playerAlive(p.x + 1, p.z), ENEMY_MAX_DT);
    expect(first.attack).toBe(true);
    expect(first.cooldown).toBe(grunt.attackInterval);
    expect(first.x).toBeCloseTo(p.x, 6);

    const blocked = stepEnemy(grunt, p, 0.5, playerAlive(p.x + 1, p.z), ENEMY_MAX_DT);
    expect(blocked.attack).toBe(false);
    expect(blocked.cooldown).toBeCloseTo(0.45, 6);
  });

  it("drifts home when the player is outside aggro range", () => {
    const p = { x: grunt.home.x + 2, z: grunt.home.z };
    const next = stepEnemy(grunt, p, 0, playerAlive(grunt.home.x + 30, grunt.home.z), ENEMY_MAX_DT);
    expect(next.x).toBeLessThan(p.x);
    expect(next.x).toBeCloseTo(p.x - grunt.speed * ENEMY_MAX_DT, 6);
    expect(next.attack).toBe(false);
  });

  it("ignores a dead player", () => {
    const p = atHome(scout);
    const next = stepEnemy(scout, p, 0, { x: p.x + 1, z: p.z, alive: false }, ENEMY_MAX_DT);
    expect(next.x).toBeCloseTo(p.x, 6);
    expect(next.z).toBeCloseTo(p.z, 6);
    expect(next.attack).toBe(false);
  });

  it("clamps a huge dt and rejects non-finite input", () => {
    // Start 5 m from home with the player far away, so the brute walks home.
    const p = { x: brute.home.x + 5, z: brute.home.z };
    const next = stepEnemy(brute, p, 0, playerAlive(p.x + 20, p.z), 10);
    expect(next.x - p.x).toBeCloseTo(-brute.speed * ENEMY_MAX_DT, 6);

    const guarded = stepEnemy(brute, { x: Number.NaN, z: Number.NaN }, 0, playerAlive(0, 0), 0.016);
    expect(Number.isFinite(guarded.x)).toBe(true);
    expect(Number.isFinite(guarded.z)).toBe(true);
  });
});
