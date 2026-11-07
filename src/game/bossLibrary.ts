// Resolves a boss-id string (roster id, endless-N, raid-*, tournament-*) to a fightable Boss instance. Pure.
import { BOSSES, RAID_BOSSES, TOURNAMENT, type Boss } from "./data";
import { endlessBoss } from "./engine";

export function buildBossFromId(id: string): Boss | null {
  const direct = BOSSES.find((b) => b.id === id);
  if (direct) return { ...direct };
  const endless = /^endless-(\d{1,4})$/.exec(id);
  if (endless) return endlessBoss(Math.max(1, Math.floor(Number(endless[1]))));
  const raid = RAID_BOSSES.find((r) => r.base.id === id);
  if (raid) return { ...raid.base };
  const tournament = TOURNAMENT.find((t) => id === `tournament-${t.id}`);
  if (tournament) {
    const template = BOSSES.find((b) => b.id === tournament.bossId);
    if (template) {
      const idx = TOURNAMENT.indexOf(tournament);
      return {
        ...template,
        id,
        name: tournament.bossName,
        hp: Math.max(1, Math.floor(template.hp * tournament.hpMult)),
        atk: Math.max(1, Math.floor(template.atk * tournament.atkMult)),
        zeni: tournament.zeni,
        tp: tournament.tp,
        req: tournament.entry,
        emoji: tournament.emoji,
        tournament: idx,
      };
    }
  }
  return null;
}

export function bossIdSuggestions(): string[] {
  return [
    ...BOSSES.map((b) => b.id),
    ...RAID_BOSSES.map((r) => r.base.id),
    ...TOURNAMENT.map((t) => `tournament-${t.id}`),
    "endless-1",
  ];
}
