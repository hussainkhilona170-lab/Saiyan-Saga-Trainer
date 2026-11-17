import { describe, expect, it } from "vitest";
import {
  awardXp,
  BASE_XP_PER_LEVEL,
  createProgress,
  maxHpForLevel,
  maxKiForLevel,
  xpToNextLevel,
  XP_PER_KILL,
  XP_PER_MELEE_HIT,
} from "@/genesis/sim/progression";

describe("genesis progression", () => {
  it("starts at level 1 with zero xp", () => {
    const p = createProgress();
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
  });

  it("accumulates xp without leveling below the threshold", () => {
    const { progress, levelsGained } = awardXp(createProgress(), 40);
    expect(progress.level).toBe(1);
    expect(progress.xp).toBe(40);
    expect(levelsGained).toBe(0);
  });

  it("levels up when xp reaches the threshold", () => {
    const { progress, levelsGained } = awardXp(createProgress(), 100);
    expect(progress.level).toBe(2);
    expect(progress.xp).toBe(0);
    expect(levelsGained).toBe(1);
  });

  it("carries overflow xp into the next level", () => {
    const { progress } = awardXp(createProgress(), 150);
    expect(progress.level).toBe(2);
    expect(progress.xp).toBe(50);
  });

  it("levels up multiple times in one award", () => {
    const { progress, levelsGained } = awardXp(createProgress(), 300);
    expect(progress.level).toBe(3);
    expect(levelsGained).toBe(2);
  });

  it("xpToNextLevel scales with level", () => {
    expect(xpToNextLevel(1)).toBe(BASE_XP_PER_LEVEL);
    expect(xpToNextLevel(3)).toBe(BASE_XP_PER_LEVEL * 3);
  });

  it("maxKi and maxHp grow with level", () => {
    expect(maxKiForLevel(1)).toBe(100);
    expect(maxKiForLevel(2)).toBe(110);
    expect(maxHpForLevel(3)).toBe(130);
  });

  it("ignores negative xp awards", () => {
    const { progress, levelsGained } = awardXp(createProgress(), -50);
    expect(progress.level).toBe(1);
    expect(progress.xp).toBe(0);
    expect(levelsGained).toBe(0);
  });

  it("melee award constants are positive", () => {
    expect(XP_PER_MELEE_HIT).toBeGreaterThan(0);
    expect(XP_PER_KILL).toBeGreaterThan(XP_PER_MELEE_HIT);
  });
});
