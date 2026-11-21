/**
 * Genesis — quest progression rules. Pure TypeScript: no three.js, no React.
 *
 * Enemy and boss defeats are counted separately. A single shared counter let an
 * ordinary enemy kill complete the "Defeat the boss" quest. Counter quests are
 * also measured from the moment they become active, so a boss defeated while an
 * earlier quest was running does not instantly complete the boss quest.
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

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Progress for a quest, measured from the count when that quest became active. */
export function questProgress(
  quest: GenesisQuest,
  level: number,
  kills: KillCounts,
  base: KillCounts,
): number {
  if (quest.type === "level") return safeCount(level);
  const kind = quest.type === "boss" ? "boss" : "enemy";
  return Math.max(0, safeCount(kills[kind]) - safeCount(base[kind]));
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

/**
 * Baseline to snapshot when `quest` becomes active. Only the counter that the
 * quest reads is carried over, so the next quest never inherits progress from
 * kills that happened before it started.
 */
export function questBaseline(quest: GenesisQuest, kills: KillCounts): KillCounts {
  if (quest.type === "kills") return { enemy: safeCount(kills.enemy), boss: 0 };
  if (quest.type === "boss") return { enemy: 0, boss: safeCount(kills.boss) };
  return { enemy: 0, boss: 0 };
}
