import { describe, expect, it } from "vitest";
import { GENESIS_QUESTS, questComplete, questProgress } from "../genesis/sim/quests";

const enemies = GENESIS_QUESTS.find((q) => q.type === "kills")!;
const boss = GENESIS_QUESTS.find((q) => q.type === "boss")!;
const level = GENESIS_QUESTS.find((q) => q.type === "level")!;

function counts(enemy = 0, bossKills = 0) {
  return { enemy, boss: bossKills };
}

describe("Genesis quest rules", () => {
  it("does not let ordinary enemy kills complete the boss quest", () => {
    const kills = counts(5, 0);
    expect(questComplete(enemies, 1, kills, counts())).toBe(true);
    expect(questComplete(boss, 1, kills, counts())).toBe(false);
    expect(questProgress(boss, 1, kills, counts())).toBe(0);
  });

  it("completes the boss quest from a boss defeat", () => {
    const kills = counts(0, 1);
    expect(questComplete(boss, 1, kills, counts())).toBe(true);
    expect(questComplete(enemies, 1, kills, counts())).toBe(false);
  });

  it("measures kills from the moment the quest became active", () => {
    // Three kills happened before this quest started.
    const base = counts(3, 0);
    expect(questProgress(enemies, 1, counts(5, 0), base)).toBe(2);
    expect(questComplete(enemies, 1, counts(5, 0), base)).toBe(false);
    expect(questComplete(enemies, 1, counts(8, 0), base)).toBe(true);
  });

  it("reads the live level for the level quest", () => {
    expect(questComplete(level, 4, counts(), counts())).toBe(false);
    expect(questComplete(level, 5, counts(), counts())).toBe(true);
  });
});
