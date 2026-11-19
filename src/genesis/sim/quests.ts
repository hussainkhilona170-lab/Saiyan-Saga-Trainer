/**
 * Genesis — quest progression rules. Pure TypeScript: no three.js, no React.
 *
 * Enemy and boss defeats are counted separately. A single shared counter let an
 * ordinary enemy kill complete the "Defeat the boss" quest.
 */

export type GenesisQuest = {
  name: string;
  target: number;
  type: "kills" | "boss" | "level";
};

export const GENESIS_QUESTS: readonly GenesisQuest[] = [
  { name: "Defeat 5 enemies", target: 5, type: "kills" },
  { name: "Defeat the boss", target: 1, type: "boss" },
  { name: "Reach level 5", target: 5, type: "level" },
];

export type KillCounts = { enemy: number; boss: number };

/** Progress for a quest, measured from the count when that quest became active. */
export function questProgress(
  quest: GenesisQuest,
  level: number,
  kills: KillCounts,
  base: KillCounts,
): number {
  if (quest.type === "level") return level;
  const kind = quest.type === "boss" ? "boss" : "enemy";
  return kills[kind] - base[kind];
}

/** True when the active quest has reached its target. */
export function questComplete(
  quest: GenesisQuest,
  level: number,
  kills: KillCounts,
  base: KillCounts,
): boolean {
  return questProgress(quest, level, kills, base) >= quest.target;
}
