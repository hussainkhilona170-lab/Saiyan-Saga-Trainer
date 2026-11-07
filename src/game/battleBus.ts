// One-way command bus: the God Engine admin panel sends live battle overrides;
// the mounted BattleTab owns the BattleState and applies them. The panel never
// touches battle state directly, so battle rules stay in engine.ts + BattleTab.
import type { Boss } from "./data";

export type BattleCommand =
  | { type: "FORCE_WIN" }
  | { type: "FORCE_FLEE" }
  | { type: "HEAL_PLAYER" }
  | { type: "SET_BOSS_HP"; pct: number }
  | { type: "REFILL_KI" }
  | { type: "FORCE_CLASH" }
  | { type: "SPAWN_BOSS"; boss: Boss };

type Handler = (command: BattleCommand) => void;
let handler: Handler | null = null;

export function registerBattleHandler(h: Handler | null): void {
  handler = h;
}

export function sendBattleCommand(command: BattleCommand): void {
  handler?.(command);
}

export function isBattleLive(): boolean {
  return handler !== null;
}
