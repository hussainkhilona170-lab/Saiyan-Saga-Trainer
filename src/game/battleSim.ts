// Deterministic boss-fight simulation for the God Engine's automated tester.
// Same inputs → same outputs. NOT a substitute for a live canvas battle: RNG-free, no human reflexes.
import {
  battleGrade, initialBattleState, resolveBattleAction, type BattleState, type GameState, type BattleGrade,
} from "./engine";
import type { Boss } from "./data";

export type FightSimResult = {
  result: "win" | "lose" | "timeout";
  seconds: number;
  bossHpLeft: number;
  playerHpLeft: number;
  playerHpLeftFraction: number;
  damageDealt: number;
  damageTaken: number;
  grade: BattleGrade | "F";
  bossPhaseReached: 1 | 2 | 3;
};

/** A sane, documented rotation: punch twice, fire a blast when Ki is high, ultimate at full Ki. Deterministic. */
export function simulateBossFight(game: GameState, boss: Boss, maxSeconds = 240): FightSimResult {
  const g = structuredClone(game);
  let battle: BattleState = structuredClone(initialBattleState);
  battle = resolveBattleAction(battle, g, {
    type: "START_BATTLE", boss: structuredClone(boss),
    playerMaxHp: Math.floor((100 + g.stats.defense * 20) * 1), initialKi: g.passes.includes("kicharge") ? 100 : 0,
  });
  const maxPlayerHp = battle.maxPlayerHp;
  const startKi = g.stats.ki;
  let tick = 0;
  let now = 1000;
  let damageDealtTotal = 0;
  let damageTakenTotal = 0;
  let lastPlayerHp = battle.playerHp;
  let lastBossHp = battle.hp;
  let blastOffset = 0;
  while (now < maxSeconds * 1000 && battle.phase !== "won" && battle.phase !== "lost") {
    tick++;
    if (battle.phase === "clash") {
      battle = resolveBattleAction(battle, g, { type: "CLASH_PUSH", agility: g.stats.agility });
      // The clash drains the enemy every 100ms in the real arena; simulate the same pressure.
      battle = resolveBattleAction(battle, g, { type: "CLASH_TICK", pressurePerSecond: 9 + Math.max(0, 0), deltaSeconds: 0.25, elapsedMs: tick * 250 });
      now += 250;
      continue;
    }
    const kiCost = 15; // blast is the cheapest reliable energy spend; rank effects are passthrough anyway
    const doBlast = g.infiniteKi || battle.ki >= 60;
    const action = tick % 10 === 0 && doBlast
      ? { type: "BLAST" as const }
      : tick % 25 === 0 && battle.ki >= 100
        ? { type: "ULTIMATE" as const }
        : { type: "PUNCH" as const, now };
    const prevBossHp = battle.hp;
    const prevPlayerHp = battle.playerHp;
    battle = resolveBattleAction(battle, g, { ...action, now });
    damageDealtTotal += Math.max(0, prevBossHp - battle.hp);
    if (tick % 4 === 0) {
      const prevP = battle.playerHp;
      battle = resolveBattleAction(battle, g, { type: "ENEMY_TICK", playerMaxHp: maxPlayerHp, now });
      damageTakenTotal += Math.max(0, prevP - battle.playerHp);
    }
    now += 250;
    // Cheap anti-stall: cap total simulated actions.
    if (tick > maxSeconds * 4 + 50) break;
  }
  const bossHpLeft = Math.max(0, battle.hp);
  const playerHpLeft = Math.max(0, battle.playerHp);
  const result = battle.phase === "won" ? "win" : battle.phase === "lost" ? "lose" : "timeout";
  const aliveFraction = playerHpLeft / Math.max(1, maxPlayerHp);
  return {
    result,
    seconds: Math.round(now / 1000),
    bossHpLeft,
    playerHpLeft,
    playerHpLeftFraction: Math.max(0, Math.min(1, aliveFraction)),
    damageDealt: damageDealtTotal,
    damageTaken: damageTakenTotal,
    grade: result === "win" ? battleGrade(aliveFraction) : "F",
    bossPhaseReached: battle.phaseNumber,
  };
}

/** Compares a roster of candidate builds... kept deliberately tiny: one game, many bosses. */
export function simulateBossLadder(game: GameState, bosses: Boss[], maxSeconds = 180): Array<{ bossId: string; result: FightSimResult }> {
  return bosses.map((boss) => ({ bossId: boss.id, result: simulateBossFight(game, boss, maxSeconds) }));
}
