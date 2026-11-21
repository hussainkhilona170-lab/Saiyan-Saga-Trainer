import { describe, expect, it } from "vitest";
import {
  BOSS_AGGRO_RANGE,
  BOSS_ATTACK_DAMAGE,
  BOSS_ATTACK_INTERVAL,
  BOSS_ATTACK_RANGE,
  BOSS_HOME,
  BOSS_LEASH_RANGE,
  BOSS_MAX_DT,
  BOSS_MAX_HP,
  BOSS_SPEED,
  createBossState,
  engageBoss,
  stepBoss,
  type BossAiState,
} from "../genesis/sim/boss";

const playerAt = (x: number, z: number, alive = true) => ({ x, z, alive });

describe("Genesis boss constants", () => {
  it("starts dormant at home and out of reach of the spawn point", () => {
    const spawnDistance = Math.hypot(BOSS_HOME.x, BOSS_HOME.z);
    expect(spawnDistance).toBeGreaterThan(BOSS_AGGRO_RANGE);
    expect(BOSS_LEASH_RANGE).toBeGreaterThan(BOSS_AGGRO_RANGE);
    expect(BOSS_MAX_HP).toBe(300);
    expect(BOSS_ATTACK_DAMAGE).toBe(20);
    expect(createBossState()).toEqual({
      x: BOSS_HOME.x,
      z: BOSS_HOME.z,
      cooldown: 0,
      mode: "idle",
    });
  });
});

describe("Genesis boss AI", () => {
  it("ignores a player standing at the scene spawn", () => {
    const tick = stepBoss(createBossState(), playerAt(0, 0), 0.05);
    expect(tick.mode).toBe("idle");
    expect(tick.x).toBe(BOSS_HOME.x);
    expect(tick.z).toBe(BOSS_HOME.z);
    expect(tick.attack).toBe(false);
  });

  it("wakes up when the player enters its aggro radius", () => {
    const tick = stepBoss(createBossState(), playerAt(4, -2), 0.05);
    expect(tick.mode).toBe("chase");
    expect(tick.x).toBeLessThan(BOSS_HOME.x);
    expect(tick.z).toBeGreaterThan(BOSS_HOME.z);
    expect(tick.attack).toBe(false);
  });

  it("closes only to attack range and strikes on its cooldown", () => {
    const close = { ...createBossState(), mode: "chase" as const };
    const player = playerAt(close.x - 4, close.z);
    const first = stepBoss(close, player, BOSS_MAX_DT);
    expect(first.x).toBeCloseTo(close.x - BOSS_SPEED * BOSS_MAX_DT, 6);
    expect(first.attack).toBe(false);

    const inRange = { ...close, x: player.x + BOSS_ATTACK_RANGE - 0.1 };
    const strike = stepBoss(inRange, player, 0.05);
    expect(strike.attack).toBe(true);
    expect(strike.cooldown).toBe(BOSS_ATTACK_INTERVAL);
    expect(strike.x).toBeCloseTo(inRange.x, 6);

    const held = stepBoss(strike, player, 0.05);
    expect(held.attack).toBe(false);
    expect(held.cooldown).toBeCloseTo(BOSS_ATTACK_INTERVAL - 0.05, 6);
  });

  it("leashes a chase that drags it too far from home", () => {
    const away: BossAiState = {
      ...createBossState(),
      x: BOSS_HOME.x + BOSS_LEASH_RANGE + 0.5,
      mode: "chase",
    };
    const tick = stepBoss(away, playerAt(away.x - 1, away.z), 0.05);
    expect(tick.mode).toBe("return");
    expect(tick.attack).toBe(false);
    expect(tick.x).toBeLessThan(away.x);
  });

  it("stays in return until it reaches home, even with the player on top of it", () => {
    const returning: BossAiState = {
      ...createBossState(),
      x: BOSS_HOME.x + 3,
      mode: "return",
    };
    const tick = stepBoss(returning, playerAt(returning.x, returning.z), 0.05);
    expect(tick.mode).toBe("return");
    expect(tick.attack).toBe(false);
    expect(tick.x).toBeLessThan(returning.x);
  });

  it("idles again once home", () => {
    const almostHome: BossAiState = {
      ...createBossState(),
      x: BOSS_HOME.x + 0.1,
      mode: "return",
    };
    const tick = stepBoss(almostHome, playerAt(60, 60), 0.05);
    expect(tick.mode).toBe("idle");
    expect(tick.attack).toBe(false);
  });

  it("resets to its guard post when the player dies", () => {
    const fighting: BossAiState = {
      ...createBossState(),
      x: BOSS_HOME.x + 4,
      mode: "chase",
    };
    const tick = stepBoss(fighting, playerAt(fighting.x, fighting.z, false), 0.05);
    expect(tick.mode).toBe("return");
    expect(tick.attack).toBe(false);
    expect(tick.x).toBeLessThan(fighting.x);
  });

  it("engages immediately when the God Engine spawns it", () => {
    expect(engageBoss().mode).toBe("chase");
    expect(engageBoss().x).toBe(BOSS_HOME.x);
  });

  it("clamps a huge dt and rejects non-finite state", () => {
    const chasing = { ...createBossState(), mode: "chase" as const };
    const player = playerAt(60, 60);
    const tick = stepBoss(chasing, player, 10);
    const moved = Math.hypot(tick.x - BOSS_HOME.x, tick.z - BOSS_HOME.z);
    expect(moved).toBeLessThanOrEqual(BOSS_SPEED * BOSS_MAX_DT + 1e-9);

    const guarded = stepBoss(
      { x: Number.NaN, z: Number.NaN, cooldown: Number.NaN, mode: "chase" },
      playerAt(Number.NaN, 0),
      0.016,
    );
    expect(Number.isFinite(guarded.x)).toBe(true);
    expect(Number.isFinite(guarded.z)).toBe(true);
    expect(guarded.cooldown).toBeGreaterThanOrEqual(0);
  });
});
