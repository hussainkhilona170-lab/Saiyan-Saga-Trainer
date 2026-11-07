// Pure game rules: no React, no browser APIs. All state transitions live here.
import { BOSSES, FORMS, LOCATIONS, PASSES, QUESTS, WISHES, SAGA_BONUSES, TOURNAMENT, type Boss, type Form, type Quest, type QuestKind, type StatKey } from "./data";

export type TournamentBoss = Boss & { tournament?: number };

export type Transaction = { id: string; at: number; kind: "credit" | "debit"; currency: "zeni" | "tp"; amount: number; label: string; balance: number };

export type GameState = {
  stats: Record<StatKey, number>;
  level: number;
  xp: number;
  mastery: Record<StatKey, number>;
  stamina: number;
  maxStamina: number;
  gravity: number;
  gravityProgress: number;
  zeni: number;
  tp: number;
  dragonBalls: number;
  forms: string[];
  customForms: Form[];
  activeForm: string;
  location: string;
  passes: string[];
  defeated: string[];
  quests: string[];
  autoTarget: StatKey;
  godMode: boolean;
  infiniteZeni: boolean;
  darkAura: boolean;
  maxStaminaBonus: number;
  transactions: Transaction[];
  questProgress: Record<string, number>;
  sagaBonuses: string[];
  tournamentRound: number;
};

export const initialState: GameState = {
  stats: { strength: 1, agility: 1, ki: 1, defense: 1 }, level: 1, xp: 0,
  mastery: { strength: 0, agility: 0, ki: 0, defense: 0 },
  stamina: 100, maxStamina: 100, gravity: 1, gravityProgress: 0,
  zeni: 0, tp: 0, dragonBalls: 0,
  forms: ["base"], customForms: [], activeForm: "base", location: "roshi",
  passes: [], defeated: [], quests: [], autoTarget: "strength",
  godMode: false, infiniteZeni: false, darkAura: false,
  maxStaminaBonus: 0,
  transactions: [],
  questProgress: {},
  sagaBonuses: [],
  tournamentRound: 0,
};

export const MAX_SAVE_NUMBER = 1e18;
export const MAX_TRANSACTIONS = 200;

/** Clamps a persisted number to a finite, non-negative bound (extreme-number protection). */
export function clampSaveNumber(value: unknown, fallback = 0, max: number = MAX_SAVE_NUMBER): number {
  return typeof value === "number" && isFinite(value) && value >= 0 ? Math.min(value, max) : fallback;
}

export function logTransaction(d: GameState, kind: Transaction["kind"], currency: Transaction["currency"], amount: number, label: string, at = Date.now()): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const balance = currency === "zeni" ? d.zeni : d.tp;
  d.transactions.push({ id: `${at}-${d.transactions.length}`, at, kind, currency, amount: Math.floor(amount), label: label.slice(0, 80), balance: Math.floor(balance) });
  if (d.transactions.length > MAX_TRANSACTIONS) d.transactions.splice(0, d.transactions.length - MAX_TRANSACTIONS);
}

export const CUSTOM_FORM_MAX_MULT = 5000;
export const allForms = (s: GameState): Form[] => [...FORMS, ...(s.customForms ?? [])];
export const findForm = (s: GameState, id: string) => allForms(s).find((f) => f.id === id);
export const formMult = (s: GameState) => findForm(s, s.activeForm)?.mult ?? 1;
export const gravMult = (s: GameState) => Math.min(1e6, 1 + (s.gravity - 1) * 0.25);
export const powerLevel = (s: GameState) => {
  const pl = Math.floor((s.stats.strength + s.stats.agility + s.stats.ki + s.stats.defense) * gravMult(s) * formMult(s) * 10);
  return Number.isFinite(pl) ? Math.min(pl, MAX_SAVE_NUMBER) : MAX_SAVE_NUMBER;
};

export const trainingGain = (s: GameState) => {
  const loc = LOCATIONS.find((l) => l.id === s.location)?.mult ?? 1;
  const gain = loc * gravMult(s) * (s.passes.includes("x2") ? 2 : 1) * Math.pow(formMult(s), 0.75);
  return Number.isFinite(gain) ? Math.min(gain, MAX_SAVE_NUMBER) : MAX_SAVE_NUMBER;
};

export const xpRequiredForLevel = (level: number) => Math.max(0, (Math.max(1, Math.floor(level)) - 1) * Math.max(1, Math.floor(level)) * 50);

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < 100 && xp >= xpRequiredForLevel(level + 1)) level++;
  return level;
}

export function rankForLevel(level: number): string {
  if (level >= 30) return "Legend";
  if (level >= 25) return "Divine";
  if (level >= 20) return "Ascendant";
  if (level >= 15) return "Master";
  if (level >= 10) return "Elite";
  if (level >= 5) return "Fighter";
  return "Novice";
}

export const statSoftCap = (level: number) => 100 + (Math.max(1, level) - 1) * 40;

export function effectiveTrainingGain(s: GameState, stat: StatKey, rawGain = trainingGain(s)): number {
  const cap = statSoftCap(s.level);
  return rawGain * (1 + Math.min(100, Math.max(0, s.mastery[stat])) / 200) / (1 + Math.max(0, s.stats[stat]) / cap);
}

export function canUnlockForm(s: GameState, formId: string): boolean {
  const form = findForm(s, formId);
  return Boolean(form && !s.forms.includes(form.id) && s.level >= form.levelReq && powerLevel(s) >= form.req && (s.infiniteZeni || s.zeni >= form.cost) && (!form.pass || s.passes.includes(form.pass)));
}

export function battleExperienceReward(boss: Boss): number {
  return 50 + battleSagaRank(boss) * 75 + Math.floor(Math.log10(boss.hp + 1) * 10);
}

export function questExperienceReward(id: string): number {
  const quest = QUESTS.find((entry) => entry.id === id);
  if (!quest) return 0;
  return 25 + quest.tp * 2 + Math.floor(Math.log10(quest.zeni + 1) * 5);
}

/** Increments counted objectives (train/explore/collect/wish/tournament) for every matching quest. */
export function bumpQuestProgress(d: GameState, kind: QuestKind, amount = 1, stat?: StatKey): void {
  for (const q of QUESTS) {
    if (q.kind !== kind) continue;
    if (kind === "train" && q.stat && stat !== q.stat) continue;
    const current = typeof d.questProgress[q.id] === "number" && isFinite(d.questProgress[q.id] ?? 0) ? d.questProgress[q.id]! : 0;
    d.questProgress[q.id] = current + amount;
  }
}

export function prerequisitesMet(s: GameState, quest: Quest): boolean {
  return !quest.prereq || quest.prereq.every((p) => s.quests.includes(p));
}

export type QuestSummary = { quest: Quest; done: boolean; progress: number; target: number; locked: boolean; prereqs: string[] };

export function questSummary(s: GameState, questId: string): QuestSummary | null {
  const quest = QUESTS.find((entry) => entry.id === questId);
  if (!quest) return null;
  const locked = !prerequisitesMet(s, quest);
  let done = false;
  let progress = 0;
  switch (quest.kind) {
    case "pl": progress = Math.min(powerLevel(s), quest.count); done = powerLevel(s) >= quest.count; break;
    case "boss": progress = quest.boss && s.defeated.includes(quest.boss) ? 1 : 0; done = progress === 1; break;
    case "level": progress = Math.min(s.level, quest.count); done = s.level >= quest.count; break;
    default: progress = Math.min(d_clamp(s.questProgress[quest.id]), quest.count); done = progress >= quest.count; break;
  }
  if (locked) done = false;
  return { quest, done, progress, target: quest.count, locked, prereqs: quest.prereq ?? [] };
}

function d_clamp(value: number | undefined): number {
  return typeof value === "number" && isFinite(value) && value >= 0 ? value : 0;
}

export function questProgressFraction(s: GameState, questId: string): number {
  const summary = questSummary(s, questId);
  return summary ? summary.progress / Math.max(1, summary.target) : 0;
}

export function questDone(s: GameState, id: string) {
  const q = QUESTS.find((x) => x.id === id);
  if (!q) return false;
  return questSummary(s, id)?.done ?? false;
}

export function sagaQuests(saga: string): Quest[] {
  return QUESTS.filter((q) => q.saga === saga);
}

export type SagaStatus = { saga: string; claimed: number; total: number; complete: boolean; bonusClaimed: boolean; bonus: { zeni: number; tp: number } };

export function sagaStatus(s: GameState, saga: string): SagaStatus {
  const quests = sagaQuests(saga);
  const claimed = quests.filter((q) => s.quests.includes(q.id)).length;
  const complete = quests.length > 0 && claimed === quests.length;
  return { saga, claimed, total: quests.length, complete, bonusClaimed: s.sagaBonuses.includes(saga), bonus: SAGA_BONUSES[saga] ?? { zeni: 0, tp: 0 } };
}

export type GameAction =
  | { type: "TRAIN_STAT"; stat: StatKey; rand?: number }
  | { type: "TRAIN_GRAVITY" }
  | { type: "TICK" }
  | { type: "CLAIM_QUEST"; questId: string }
  | { type: "FORCE_CLAIM_QUEST"; questId: string }
  | { type: "UNLOCK_FORM"; formId: string }
  | { type: "TRANSFORM"; formId: string }
  | { type: "BUY_PASS"; passId: string }
  | { type: "MAKE_WISH"; wishId: string }
  | { type: "SCOUT"; rand?: number }
  | { type: "TOURNAMENT_WIN"; round: number }
  | { type: "CLAIM_SAGA"; saga: string }
  | { type: "CREATE_FORM"; id: string; name: string; mult: number; aura: string; hair: string }
  | { type: "DELETE_FORM"; formId: string };

export type BattlePhase = "idle" | "active" | "clash" | "won" | "lost";

export type BattleState = {
  boss: Boss | null;
  phase: BattlePhase;
  hp: number;
  playerHp: number;
  maxPlayerHp: number;
  ki: number;
  clashProgress: number;
  clashCount: number;
  combo: number;
  lastPunchAt: number;
  message: string;
};

export const initialBattleState: BattleState = {
  boss: null, phase: "idle", hp: 0, playerHp: 0, maxPlayerHp: 0, ki: 0,
  clashProgress: 50, clashCount: 0, combo: 0, lastPunchAt: 0, message: "",
};

export type CombatAction =
  | { type: "START_BATTLE"; boss: Boss; playerMaxHp: number; initialKi: number }
  | { type: "PUNCH"; now: number }
  | { type: "RESET_COMBO"; now: number }
  | { type: "BLAST" }
  | { type: "ULTIMATE" }
  | { type: "VANISH" }
  | { type: "CHARGE"; amount: number }
  | { type: "ENEMY_TICK"; playerMaxHp: number }
  | { type: "CLASH_START" }
  | { type: "CLASH_PUSH"; agility: number }
  | { type: "CLASH_TICK"; pressurePerSecond: number; deltaSeconds: number; elapsedMs: number }
  | { type: "FLEE" };

/** Pure combat state transition. UI and timers dispatch actions; rules stay here. */
export function resolveBattleAction(battle: BattleState, game: GameState, action: CombatAction): BattleState {
  const next = { ...battle };
  const boss = next.boss;
  const multiplier = formMult(game) * gravMult(game);

  const resolvePlayerDamage = () => {
    if (next.hp <= 0 && boss) {
      next.hp = 0;
      next.phase = "won";
      next.message = `You defeated ${boss.name}!`;
    }
  };
  const resolvePlayerDefeat = () => {
    if (next.playerHp <= 0) {
      next.playerHp = 0;
      next.phase = "lost";
      next.message = `${boss?.name ?? "The enemy"} defeated you… train harder!`;
    }
  };

  switch (action.type) {
    case "START_BATTLE":
      return {
        ...initialBattleState,
        boss: action.boss,
        phase: "active",
        hp: action.boss.hp,
        playerHp: action.playerMaxHp,
        maxPlayerHp: action.playerMaxHp,
        ki: action.initialKi,
        message: `${action.boss.name} appears!`,
      };
    case "PUNCH": {
      if (next.phase !== "active" || !boss) return next;
      next.combo = action.now - next.lastPunchAt < 950 ? (next.combo % 8) + 1 : 1;
      next.lastPunchAt = action.now;
      const bonus = 1 + Math.min(7, next.combo - 1) * 0.09;
      next.hp -= (game.stats.strength * 2 + game.stats.agility) * multiplier * bonus;
      resolvePlayerDamage();
      return next;
    }
    case "RESET_COMBO":
      if (action.now - next.lastPunchAt >= 1100) next.combo = 0;
      return next;
    case "BLAST":
      if (next.phase !== "active" || !boss || next.ki < 20) return next;
      next.ki -= 20;
      next.hp -= game.stats.ki * 10 * multiplier;
      resolvePlayerDamage();
      return next;
    case "ULTIMATE":
      if (next.phase !== "active" || !boss || next.ki < 100) return next;
      next.ki = 0;
      next.hp -= (game.stats.ki * 40 + game.stats.strength * 10) * multiplier;
      resolvePlayerDamage();
      return next;
    case "VANISH":
      if (next.phase !== "active" || !boss || next.ki < 15) return next;
      next.ki -= 15;
      next.hp -= (game.stats.agility * 5 + game.stats.strength * 2) * multiplier;
      resolvePlayerDamage();
      return next;
    case "CHARGE":
      if (next.phase === "active" && boss) next.ki = Math.min(100, next.ki + action.amount);
      return next;
    case "ENEMY_TICK":
      if (next.phase !== "active" && next.phase !== "clash") return next;
      if (!boss) return next;
      if (!game.godMode) {
        const damage = Math.max(1, boss.atk - game.stats.defense * multiplier * 0.5);
        next.playerHp -= damage * (next.phase === "clash" ? 0.35 : 1);
        resolvePlayerDefeat();
      }
      if (game.passes.includes("kicharge") && next.playerHp > 0) next.ki = 100;
      return next;
    case "CLASH_START":
      if (next.phase === "active" && boss) {
        next.phase = "clash";
        next.clashProgress = 50;
        next.message = "Beam clash! Push to overpower your opponent.";
      }
      return next;
    case "CLASH_PUSH":
      if (next.phase !== "clash") return next;
      next.clashProgress = Math.min(100, next.clashProgress + 3.5 + Math.min(4, Math.log10(action.agility + 1)));
      if (next.clashProgress >= 100) resolveClash(next, boss);
      return next;
    case "CLASH_TICK":
      if (next.phase !== "clash") return next;
      next.clashProgress = Math.max(0, next.clashProgress - action.pressurePerSecond * action.deltaSeconds);
      if (next.clashProgress <= 0 || action.elapsedMs > 8000) {
        if (next.clashProgress >= 50) resolveClash(next, boss);
        else resolveClashLoss(next, boss);
      }
      return next;
    case "FLEE":
      return { ...initialBattleState, message: "You fled." };
  }
}

function resolveClash(battle: BattleState, boss: Boss | null): void {
  if (!boss) return;
  battle.phase = "active";
  battle.clashCount++;
  battle.hp -= boss.hp * 0.12;
  battle.message = `Beam clash won! ${boss.name} is blasted back.`;
  if (battle.hp <= 0) {
    battle.hp = 0;
    battle.phase = "won";
    battle.message = `You defeated ${boss.name}!`;
  }
}

function resolveClashLoss(battle: BattleState, boss: Boss | null): void {
  battle.phase = "active";
  battle.clashCount++;
  battle.playerHp -= battle.maxPlayerHp * 0.18;
  battle.message = `${boss?.name ?? "The enemy"} overpowered your beam!`;
  if (battle.playerHp <= 0) {
    battle.playerHp = 0;
    battle.phase = "lost";
    battle.message = `${boss?.name ?? "The enemy"} defeated you… train harder!`;
  }
}

export function battleSagaRank(boss: Boss): number {
  return Math.max(0, BOSSES.findIndex((entry) => entry.id === boss.id));
}

export function battleClashPressure(boss: Boss): number {
  return 9 + battleSagaRank(boss) * 10;
}

export function battleClashDelay(boss: Boss): number {
  if (boss.id === "shadow-self") return 2400; // Shadow dummy always opens with a dark beam clash.
  return Math.max(6500, 11500 - battleSagaRank(boss) * 850);
}

// ===== Shadow Dummy sparring: a mirror opponent scaled to the player =====

export const SHADOW_DUMMY_MULT = 1.75;
export const SHADOW_REWARD_MULT = 1.35;
export const SHADOW_ZENKAI_MULT = 1.6;
export const SHADOW_ZENKAI_HP_FRACTION = 0.2;

/** Builds the sparring dummy: its stats are SHADOW_DUMMY_MULT× the player's current stats,
 *  so the duel stays brutally close no matter how strong the player grows. */
export function shadowDummyBoss(s: GameState): Boss {
  const multiplier = formMult(s) * gravMult(s);
  const total = s.stats.strength + s.stats.agility + s.stats.ki + s.stats.defense;
  return {
    id: "shadow-self",
    name: "Shadow Self",
    emoji: "👤",
    hp: Math.max(80, Math.floor(total * SHADOW_DUMMY_MULT * multiplier * 10)),
    atk: Math.max(6, Math.floor(total * SHADOW_DUMMY_MULT * multiplier * 0.45)),
    zeni: 0,
    tp: 0,
    req: 0,
  };
}

/** Pays the sparring reward: every stat ×SHADOW_REWARD_MULT, or the Zenkai surge
 *  (×SHADOW_ZENKAI_MULT plus a full stamina refill) when the player barely survived. */
export function applyShadowRewards(game: GameState, zenkai: boolean): void {
  const factor = zenkai ? SHADOW_ZENKAI_MULT : SHADOW_REWARD_MULT;
  for (const k of ["strength", "agility", "ki", "defense"] as StatKey[]) game.stats[k] *= factor;
  if (zenkai) game.stamina = game.maxStamina;
  grantExperience(game, 60);
}

/** Grants a Dragon Ball and feeds collect-quest progress. Returns true if a ball was gained. */
function grantBall(d: GameState): boolean {
  if (d.dragonBalls >= 7) return false;
  d.dragonBalls++;
  bumpQuestProgress(d, "collect", 1);
  return true;
}

/** Applies tournament match rewards. First clears pay in full and advance the bracket; rematches pay 15%. */
export function applyTournamentRewards(d: GameState, roundIndex: number): void {
  const round = TOURNAMENT[roundIndex];
  if (!round) return;
  const firstClear = d.tournamentRound === roundIndex;
  const scale = firstClear ? 1 : 0.15;
  const zeni = Math.floor(round.zeni * scale);
  const tp = Math.floor(round.tp * scale);
  if (zeni > 0) {
    d.zeni = clampSaveNumber(d.zeni + zeni, d.zeni);
    logTransaction(d, "credit", "zeni", zeni, `Martial Arts Tournament — ${round.name}${firstClear ? "" : " (rematch)"}`);
  }
  if (tp > 0) {
    d.tp = clampSaveNumber(d.tp + tp, d.tp);
    logTransaction(d, "credit", "tp", tp, `Martial Arts Tournament — ${round.name}${firstClear ? "" : " (rematch)"}`);
  }
  if (firstClear) d.tournamentRound = Math.min(TOURNAMENT.length, d.tournamentRound + 1);
  bumpQuestProgress(d, "tournament", 1);
  grantExperience(d, firstClear ? 120 + roundIndex * 180 : 30);
}

/** Applies a boss victory payout; the drop roll is supplied by the caller for deterministic tests. */
export function applyBattleRewards(game: GameState, boss: Boss, foundDragonBall: boolean): void {
  const zeniGain = boss.zeni * (game.passes.includes("vip") ? 1.5 : 1);
  game.zeni = clampSaveNumber(game.zeni + zeniGain, game.zeni);
  game.tp = clampSaveNumber(game.tp + boss.tp, game.tp);
  if (!game.defeated.includes(boss.id)) game.defeated.push(boss.id);
  if (foundDragonBall) grantBall(game);
  logTransaction(game, "credit", "zeni", zeniGain, `Boss victory — ${boss.name}`);
  logTransaction(game, "credit", "tp", boss.tp, `Boss victory — ${boss.name}`);
  grantExperience(game, battleExperienceReward(boss));
}

function grantExperience(state: GameState, amount: number): void {
  state.xp += Math.max(0, Math.floor(amount));
  state.level = levelForXp(state.xp);
}

function applyTraining(state: GameState, stat: StatKey, rawGain: number, xpScale = 1): number {
  const gain = effectiveTrainingGain(state, stat, rawGain);
  state.stats[stat] += gain;
  const cap = statSoftCap(state.level);
  state.mastery[stat] = Math.min(100, state.mastery[stat] + Math.min(0.3, 0.05 + gain / (cap * 20)));
  const xp = Math.max(1, Math.floor((2 + Math.log10(1 + Math.max(0, gain)) * 2) * xpScale));
  grantExperience(state, xp);
  return gain;
}

/** Pays a quest's full reward set; shared by normal claims and God Engine force-claims. */
function payQuest(d: GameState, quest: Quest): void {
  d.quests.push(quest.id);
  d.zeni = clampSaveNumber(d.zeni + quest.zeni, d.zeni);
  d.tp = clampSaveNumber(d.tp + quest.tp, d.tp);
  logTransaction(d, "credit", "zeni", quest.zeni, `Quest — ${quest.title}`);
  logTransaction(d, "credit", "tp", quest.tp, `Quest — ${quest.title}`);
  grantExperience(d, questExperienceReward(quest.id));
}

/** Applies an action to a draft (mutates). Deterministic when `rand` is supplied. */
export function applyAction(d: GameState, a: GameAction): void {
  switch (a.type) {
    case "TRAIN_STAT": {
      if (d.stamina < 1 && !d.godMode) return;
      if (!d.godMode) d.stamina -= 1;
      const g = applyTraining(d, a.stat, trainingGain(d));
      d.zeni = clampSaveNumber(d.zeni + Math.ceil(g * 0.75 * (d.passes.includes("vip") ? 1.5 : 1)), d.zeni);
      if ((a.rand ?? Math.random()) < 0.002) grantBall(d);
      bumpQuestProgress(d, "train", 1, a.stat);
      return;
    }
    case "TRAIN_GRAVITY": {
      if (d.stamina < 2 && !d.godMode) return;
      if (!d.godMode) d.stamina -= 2;
      d.gravityProgress += d.passes.includes("x2") ? 2 : 1;
      if (d.gravityProgress >= d.gravity * 25) { d.gravityProgress = 0; d.gravity++; }
      grantExperience(d, 3);
      return;
    }
    case "TICK": {
      d.maxStamina = Math.min(MAX_SAVE_NUMBER, 100 + Math.floor(d.stats.defense / 5) + Math.floor(d.maxStaminaBonus ?? 0));
      const regen = (2 + d.maxStamina * 0.02) * (d.passes.includes("vip") ? 2 : 1);
      d.stamina = Math.min(d.maxStamina, d.stamina + regen);
      if (d.passes.includes("auto")) {
        const rawGain = trainingGain(d);
        applyTraining(d, d.autoTarget, rawGain * 2, 0.25);
        d.zeni += Math.ceil(rawGain);
      }
      return;
    }
    case "CLAIM_QUEST": {
      const quest = QUESTS.find((entry) => entry.id === a.questId);
      if (!quest || d.quests.includes(quest.id) || !questDone(d, quest.id)) return;
      payQuest(d, quest);
      return;
    }
    case "FORCE_CLAIM_QUEST": {
      // God Engine override: pays quest rewards while skipping the requirements.
      const quest = QUESTS.find((entry) => entry.id === a.questId);
      if (!quest || d.quests.includes(quest.id)) return;
      payQuest(d, quest);
      return;
    }
    case "UNLOCK_FORM": {
      const form = findForm(d, a.formId);
      if (!form || !canUnlockForm(d, form.id)) return;
      if (!d.infiniteZeni) {
        d.zeni = clampSaveNumber(d.zeni - form.cost, 0);
        logTransaction(d, "debit", "zeni", form.cost, `Transformation — ${form.name}`);
      }
      d.forms.push(form.id);
      return;
    }
    case "BUY_PASS": {
      const pass = PASSES.find((p) => p.id === a.passId);
      if (!pass || d.passes.includes(pass.id) || d.tp < pass.tp) return;
      d.tp = clampSaveNumber(d.tp - pass.tp, 0);
      logTransaction(d, "debit", "tp", pass.tp, `Pass — ${pass.name}`);
      d.passes.push(pass.id);
      return;
    }
    case "MAKE_WISH": {
      const wish = WISHES.find((w) => w.id === a.wishId);
      if (!wish || d.dragonBalls < 7) return;
      d.dragonBalls = 0;
      if (wish.id === "zeni") {
        const amount = Math.floor(powerLevel(d) * 100);
        d.zeni = clampSaveNumber(d.zeni + amount, d.zeni);
        logTransaction(d, "credit", "zeni", amount, "Shenron wish — Infinite riches");
      } else if (wish.id === "power") {
        for (const k of Object.keys(d.stats) as StatKey[]) d.stats[k] = clampSaveNumber(d.stats[k] * 2, d.stats[k]);
      } else if (wish.id === "tp") {
        d.tp = clampSaveNumber(d.tp + 500, d.tp);
        logTransaction(d, "credit", "tp", 500, "Shenron wish — Medals of honor");
      } else if (wish.id === "stamina") {
        d.maxStaminaBonus = clampSaveNumber((d.maxStaminaBonus ?? 0) + 50, 0, MAX_SAVE_NUMBER);
        d.maxStamina = clampSaveNumber(d.maxStamina + 50, d.maxStamina);
        d.stamina = d.maxStamina;
      }
      bumpQuestProgress(d, "wish", 1);
      return;
    }
    case "SCOUT": {
      if (d.stamina < 2 && !d.godMode) return;
      if (!d.godMode) d.stamina -= 2;
      const loc = LOCATIONS.find((l) => l.id === d.location) ?? LOCATIONS[0]!;
      const mult = loc.mult;
      const r = typeof a.rand === "number" && isFinite(a.rand) ? Math.min(0.999999, Math.max(0, a.rand)) : Math.random();
      if (r < 0.05) grantBall(d);
      else if (r < 0.22) d.zeni = clampSaveNumber(d.zeni + Math.floor(mult * (80 + r * 600)), d.zeni);
      grantExperience(d, Math.max(2, Math.floor(mult * 2)));
      bumpQuestProgress(d, "explore", 1);
      return;
    }
    case "TOURNAMENT_WIN": {
      applyTournamentRewards(d, a.round);
      return;
    }
    case "CLAIM_SAGA": {
      const status = sagaStatus(d, a.saga);
      if (!status.complete || status.bonusClaimed) return;
      d.sagaBonuses.push(status.saga);
      d.zeni = clampSaveNumber(d.zeni + status.bonus.zeni, d.zeni);
      d.tp = clampSaveNumber(d.tp + status.bonus.tp, d.tp);
      logTransaction(d, "credit", "zeni", status.bonus.zeni, `Saga complete — ${status.saga}`);
      logTransaction(d, "credit", "tp", status.bonus.tp, `Saga complete — ${status.saga}`);
      grantExperience(d, 200 + d.quests.length * 25);
      return;
    }
    case "TRANSFORM":
      if (d.forms.includes(a.formId) && findForm(d, a.formId)) d.activeForm = a.formId;
      return;
    case "CREATE_FORM": {
      const name = a.name.trim().slice(0, 30);
      if (!name || !a.id.startsWith("custom-") || findForm(d, a.id)) return;
      const mult = Math.max(1, Math.min(CUSTOM_FORM_MAX_MULT, Number.isFinite(a.mult) ? a.mult : 1));
      d.customForms.push({ id: a.id, name, mult, req: 0, cost: 0, aura: a.aura, hair: a.hair, levelReq: 1, custom: true });
      d.forms.push(a.id);
      return;
    }
    case "DELETE_FORM": {
      if (!d.customForms.some((f) => f.id === a.formId)) return;
      d.customForms = d.customForms.filter((f) => f.id !== a.formId);
      d.forms = d.forms.filter((f) => f !== a.formId);
      if (d.activeForm === a.formId) d.activeForm = "base";
      return;
    }
  }
}

/** Merges saved data over defaults, dropping malformed fields. Preserves existing progress. */
export function hydrate(raw: unknown): GameState {
  const base = structuredClone(initialState);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<GameState>;
  const out: GameState = { ...base, ...r, stats: { ...base.stats } };
  for (const k of Object.keys(base.stats) as StatKey[]) {
    const v = r.stats?.[k];
    if (typeof v === "number" && isFinite(v) && v >= 0) out.stats[k] = Math.min(v, MAX_SAVE_NUMBER);
    else out.stats[k] = base.stats[k];
  }
  out.xp = clampSaveNumber(r.xp, 0);
  out.level = levelForXp(out.xp);
  out.mastery = { ...base.mastery };
  for (const k of Object.keys(base.mastery) as StatKey[]) {
    const mastery = r.mastery?.[k];
    if (typeof mastery === "number" && isFinite(mastery)) out.mastery[k] = Math.max(0, Math.min(100, mastery));
  }
  // Dedupe string arrays so a corrupted save cannot double-pay rewards or spam ids.
  const cleanStrings = (input: unknown, fallback: string[], allowed?: ReadonlySet<string>): string[] => {
    if (!Array.isArray(input)) return [...fallback];
    const seen = new Set<string>();
    for (const entry of input) if (typeof entry === "string" && entry && !seen.has(entry) && (!allowed || allowed.has(entry))) seen.add(entry);
    return [...seen];
  };
  const FORM_IDS = new Set(allForms(base).map((f) => f.id));
  out.forms = cleanStrings(out.forms, base.forms, undefined).filter((id) => FORM_IDS.has(id) || id.startsWith("custom-"));
  for (const k of ["passes", "defeated", "quests"] as const) out[k] = cleanStrings(out[k], base[k]);
  out.zeni = clampSaveNumber(r.zeni, 0);
  out.tp = clampSaveNumber(r.tp, 0);
  out.dragonBalls = Math.floor(clampSaveNumber(r.dragonBalls, 0, 7));
  out.maxStaminaBonus = clampSaveNumber(r.maxStaminaBonus, 0);
  out.maxStamina = Math.max(1, Math.min(MAX_SAVE_NUMBER, clampSaveNumber(r.maxStamina, 100)));
  out.stamina = Math.max(0, Math.min(out.maxStamina, clampSaveNumber(r.stamina, base.stamina, out.maxStamina)));
  out.gravity = Math.max(1, Math.min(1000, Math.floor(clampSaveNumber(r.gravity, 1, 1000))));
  out.gravityProgress = Math.max(0, Math.min(out.gravity * 25, clampSaveNumber(r.gravityProgress, 0, out.gravity * 25)));
  if (typeof out.autoTarget !== "string" || !(out.autoTarget in base.stats)) out.autoTarget = base.autoTarget;
  out.godMode = r.godMode === true;
  out.infiniteZeni = r.infiniteZeni === true;
  out.customForms = Array.isArray(r.customForms)
    ? r.customForms.filter((f): f is Form => !!f && typeof f.id === "string" && f.id.startsWith("custom-") && typeof f.name === "string" && typeof f.mult === "number" && isFinite(f.mult))
      .map((f) => ({ ...f, mult: Math.max(1, Math.min(CUSTOM_FORM_MAX_MULT, f.mult)), custom: true }))
    : [];
  // Transactions: keep only well-formed rows, cap the log.
  out.transactions = Array.isArray(r.transactions)
    ? r.transactions
      .filter((t): t is Transaction => !!t && typeof t.id === "string" && typeof t.at === "number" && isFinite(t.at) && (t.kind === "credit" || t.kind === "debit") && (t.currency === "zeni" || t.currency === "tp") && typeof t.amount === "number" && isFinite(t.amount) && typeof t.label === "string")
      .slice(-MAX_TRANSACTIONS)
      .map((t) => ({ ...t, amount: Math.floor(Math.abs(t.amount)), balance: Math.floor(Math.abs(t.balance ?? 0)) }))
    : [];
  if (!out.forms.includes("base")) out.forms.unshift("base");
  // Quest progress: keep only COUNTED quest ids (train/explore/collect/wish/tournament) with finite non-negative counters.
  const COUNTED = new Set<QuestKind>(["train", "explore", "collect", "wish", "tournament"]);
  out.questProgress = {};
  if (r.questProgress && typeof r.questProgress === "object" && !Array.isArray(r.questProgress)) {
    for (const q of QUESTS) {
      if (!COUNTED.has(q.kind)) continue;
      const v = (r.questProgress as Record<string, unknown>)[q.id];
      if (typeof v === "number" && isFinite(v) && v >= 0) out.questProgress[q.id] = Math.floor(v);
    }
  }
  out.sagaBonuses = cleanStrings(r.sagaBonuses, []).filter((saga) => saga in SAGA_BONUSES);
  out.tournamentRound = Math.max(0, Math.min(TOURNAMENT.length, Math.floor(clampSaveNumber(r.tournamentRound, 0, TOURNAMENT.length))));
  if (typeof out.activeForm !== "string" || !findForm(out, out.activeForm)) out.activeForm = "base";
  if (!LOCATIONS.some((l) => l.id === out.location)) out.location = base.location;
  out.darkAura = r.darkAura === true;
  return out;
}

// ===== Save & data integrity: versioned envelope, migrations, corruption guards =====

export const SAVE_VERSION = 2;

export type SaveEnvelope = { v: number; data: GameState };

/** Seals a state into the versioned format written to storage. */
export const sealSave = (state: GameState): string =>
  JSON.stringify({ v: SAVE_VERSION, data: state } satisfies SaveEnvelope);

/** Ordered migration steps; each upgrades one stored version to the next. */
const SAVE_MIGRATIONS: Array<{ from: number; up: (raw: unknown) => unknown }> = [
  // v1 (bare GameState, no version stamp) → v2: no shape change needed;
  // hydrate() below adds the level/xp/mastery fields and repairs damage.
  { from: 1, up: (raw) => raw },
];

/** Runs a raw payload through every migration up to SAVE_VERSION, then repairs it. */
export function migrateSave(raw: unknown, fromVersion = 1): GameState {
  let data = raw;
  for (const step of SAVE_MIGRATIONS) {
    if (step.from >= fromVersion && step.from < SAVE_VERSION) data = step.up(data);
  }
  return hydrate(data);
}

/** Parses stored save text (versioned envelope or legacy unversioned save) into a GameState.
 *  Returns null for empty, malformed, or unrecoverable input so callers can fall back. */
export function openSave(text: string | null | undefined): GameState | null {
  if (typeof text !== "string" || !text) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const version = typeof obj["v"] === "number" && isFinite(obj["v"]) ? Math.max(1, Math.floor(obj["v"])) : 1;
  const payload = version >= 2 && obj["data"] && typeof obj["data"] === "object" ? obj["data"] : obj;
  return migrateSave(payload, Math.min(version, SAVE_VERSION));
}
