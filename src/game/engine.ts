// Pure game rules: no React, no browser APIs. All state transitions live here.
import { BOSSES, FORMS, LOCATIONS, PASSES, QUESTS, WISHES, SAGA_BONUSES, TOURNAMENT, EQUIPMENT, CONSUMABLES, TECHNIQUE_RANKS, RAID_BOSSES, ENDLESS_ROSTER, ENDLESS_MODIFIERS, MAX_CUSTOM_TECHNIQUES, MAX_CUSTOM_TECHNIQUE_MULT, type Boss, type Form, type Quest, type QuestKind, type StatKey, type EndlessModifierId, type CustomTechniqueScale, type CustomTechnique } from "./data";

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
  bestGrades: Record<string, BattleGrade>;
  inventory: Record<string, number>;
  equipped: string[];
  techniqueUses: Record<string, number>;
  survivalBest: number;
  infiniteKi: boolean;
  customTechniques: CustomTechnique[];
  adminEvents: AdminEvent[];
};

export type AdminEvent = { id: string; at: number; action: string; target: string; previousValue: string; newValue: string; outcome: "ok" | "failed" | "blocked"; detail?: string };

export const initialState: GameState = {
  stats: { strength: 1, agility: 1, ki: 1, defense: 1 }, level: 1, xp: 0,
  mastery: { strength: 0, agility: 0, ki: 0, defense: 0 },
  stamina: 100, maxStamina: 100, gravity: 1,
  zeni: 0, tp: 0, dragonBalls: 0,
  forms: ["base"], customForms: [], activeForm: "base", location: "roshi",
  passes: [], defeated: [], quests: [], autoTarget: "strength",
  godMode: false, infiniteZeni: false, darkAura: false,
  maxStaminaBonus: 0,
  transactions: [],
  questProgress: {},
  sagaBonuses: [],
  tournamentRound: 0,
  bestGrades: {},
  inventory: {},
  equipped: [],
  techniqueUses: {},
  survivalBest: 0,
  infiniteKi: false,
  customTechniques: [],
  adminEvents: [],
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

/** Equipment effect totals, aggregated over currently-equipped items. */
export function equipmentBonus(s: GameState): { defenseMult: number; allStatsMult: number; trainingMult: number; scoutBallBonus: number } {
  let defenseMult = 0, allStatsMult = 0, trainingMult = 0, scoutBallBonus = 0;
  for (const id of s.equipped ?? []) {
    const item = EQUIPMENT.find((e) => e.id === id);
    if (!item) continue;
    defenseMult += item.defenseMult ?? 0;
    allStatsMult += item.allStatsMult ?? 0;
    trainingMult += item.trainingMult ?? 0;
    scoutBallBonus += item.scoutBallBonus ?? 0;
  }
  return { defenseMult, allStatsMult, trainingMult, scoutBallBonus };
}

export const techniqueRank = (s: GameState, id: string): number => {
  const uses = typeof s.techniqueUses?.[id] === "number" ? s.techniqueUses[id]! : 0;
  let rank = 0;
  for (let i = 0; i < TECHNIQUE_RANKS.length; i++) if (uses >= TECHNIQUE_RANKS[i]!) rank = i + 1;
  return rank;
};

/** Increments a technique counter (mutates draft; clamped to a sane ceiling). */
export function bumpTechniqueUse(d: GameState, id: string, amount = 1): void {
  const current = typeof d.techniqueUses[id] === "number" && isFinite(d.techniqueUses[id]!) ? d.techniqueUses[id]! : 0;
  d.techniqueUses[id] = Math.min(1_000_000, current + Math.max(1, Math.floor(amount)));
}

export const allForms = (s: GameState): Form[] => [...FORMS, ...(s.customForms ?? [])];
export const findForm = (s: GameState, id: string) => allForms(s).find((f) => f.id === id);
export const formMult = (s: GameState) => findForm(s, s.activeForm)?.mult ?? 1;
export const gravMult = (s: GameState) => Math.min(1e6, 1 + (s.gravity - 1) * 0.25);
export const powerLevel = (s: GameState) => {
  const equip = equipmentBonus(s);
  const statSum = (s.stats.strength + s.stats.agility + s.stats.ki + s.stats.defense * (1 + equip.defenseMult)) * (1 + equip.allStatsMult);
  const pl = Math.floor(statSum * gravMult(s) * formMult(s) * 10);
  return Number.isFinite(pl) ? Math.min(pl, MAX_SAVE_NUMBER) : MAX_SAVE_NUMBER;
};

export const trainingGain = (s: GameState) => {
  const loc = LOCATIONS.find((l) => l.id === s.location)?.mult ?? 1;
  const equip = equipmentBonus(s);
  const gain = loc * gravMult(s) * (s.passes.includes("x2") ? 2 : 1) * Math.pow(formMult(s), 0.75) * (1 + equip.trainingMult);
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

/** Gravity chamber level the body has adapted to at a given level — one 10G step
 *  per 2 levels (Lv 1 → 10G, Lv 2 → 20G, Lv 100 → 510G). Applied automatically on
 *  level-up; there is no manual gravity training. */
export const maxGravityForLevel = (level: number) => 1 + Math.floor(Math.max(1, Math.floor(level)) / 2);

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
  | { type: "TICK" }
  | { type: "CLAIM_QUEST"; questId: string }
  | { type: "FORCE_CLAIM_QUEST"; questId: string }
  | { type: "UNLOCK_FORM"; formId: string }
  | { type: "TRANSFORM"; formId: string }
  | { type: "BUY_PASS"; passId: string }
  | { type: "BUY_ITEM"; itemId: string }
  | { type: "EQUIP_ITEM"; itemId: string }
  | { type: "UNEQUIP_ITEM"; itemId: string }
  | { type: "MAKE_WISH"; wishId: string }
  | { type: "SCOUT"; rand?: number }
  | { type: "TOURNAMENT_WIN"; round: number }
  | { type: "CLAIM_SAGA"; saga: string }
  | { type: "RECORD_BOSS_GRADE"; bossId: string; grade: "S" | "A" | "B" | "C" | "D" }
  | { type: "CREATE_FORM"; id: string; name: string; mult: number; aura: string; hair: string }
  | { type: "DELETE_FORM"; formId: string };

export type BattlePhase = "idle" | "active" | "clash" | "won" | "lost";

/** Runtime-only combat trackers (never persisted; rebuilt on battle start). */
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
  /** Timestamps (ms) driving guard/exposed/overload windows. */
  guardUntil: number;
  guardCdUntil: number;
  exposedUntil: number;
  overloadedUntil: number;
  /** Boss phase derived from remaining HP (1 = opener, 2 = enraged, 3 = critical). */
  phaseNumber: 1 | 2 | 3;
  bossSpecialAt: number;
  /** Adaptive tracking — streaks of repeated strategies the boss can punish. */
  meleeStreak: number;
  kiStreak: number;
  adaptMeleeUntil: number;
  /** Technique cooldowns by technique id (built-in ids reserved, custom techs use their own id). */
  cooldowns: Record<string, number>;
};

export const initialBattleState: BattleState = {
  boss: null, phase: "idle", hp: 0, playerHp: 0, maxPlayerHp: 0, ki: 0,
  clashProgress: 50, clashCount: 0, combo: 0, lastPunchAt: 0, message: "",
  guardUntil: 0, guardCdUntil: 0, exposedUntil: 0, overloadedUntil: 0,
  phaseNumber: 1, bossSpecialAt: 0,
  meleeStreak: 0, kiStreak: 0, adaptMeleeUntil: 0,
  cooldowns: {},
};

export type CombatAction =
  | { type: "START_BATTLE"; boss: Boss; playerMaxHp: number; initialKi: number }
  | { type: "PUNCH"; now: number }
  | { type: "HEAVY"; now?: number }
  | { type: "RESET_COMBO"; now: number }
  | { type: "BLAST"; now?: number }
  | { type: "ULTIMATE"; now?: number }
  | { type: "VANISH"; now?: number }
  | { type: "PERFECT_GUARD"; now: number; uiForm?: boolean }
  | { type: "USE_CONSUMABLE"; consumable: "senzu" | "tonic" }
  | { type: "CUSTOM_TECHNIQUE"; techniqueId: string; now?: number }
  | { type: "CHARGE"; amount: number }
  | { type: "ENEMY_TICK"; playerMaxHp: number; now?: number }
  | { type: "CLASH_START" }
  | { type: "CLASH_PUSH"; agility: number }
  | { type: "CLASH_TICK"; pressurePerSecond: number; deltaSeconds: number; elapsedMs: number }
  | { type: "FLEE" };

export const phaseScale = (phaseNumber: 1 | 2 | 3): number => phaseNumber === 3 ? 1.7 : phaseNumber === 2 ? 1.35 : 1;
export const battlePhaseOf = (bossHp: number, bossMaxHp: number): 1 | 2 | 3 => {
  const frac = bossMaxHp > 0 ? bossHp / bossMaxHp : 1;
  return frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
};
export type BattleGrade = "S" | "A" | "B" | "C" | "D";
export const battleGrade = (playerHpFraction: number): BattleGrade =>
  playerHpFraction >= 0.85 ? "S" : playerHpFraction >= 0.65 ? "A" : playerHpFraction >= 0.4 ? "B" : playerHpFraction >= 0.15 ? "C" : "D";
export const GRADE_ORDER: BattleGrade[] = ["D", "C", "B", "A", "S"];

/** Pure combat state transition. UI and timers dispatch actions; rules stay here. */
export function resolveBattleAction(battle: BattleState, game: GameState, action: CombatAction): BattleState {
  const next = { ...battle };
  const boss = next.boss;
  const multiplier = formMult(game) * gravMult(game);
  const now = "now" in action && typeof action.now === "number" ? action.now : 0;

  /** Weak-point window: boss takes double damage while exposed. Also tracks master transitions. */
  const damageBoss = (rawDamage: number) => {
    if (!boss) return;
    const exposed = now > 0 && now < next.exposedUntil;
    next.hp -= rawDamage * (exposed ? 2 : 1);
    if (next.hp <= 0) return; // resolvePlayerDamage sets the win message; no phase surge after death
    refreshPhase();
  };
  const refreshPhase = () => {
    if (!boss || next.phase === "won" || next.phase === "lost") return;
    const phaseNumber = battlePhaseOf(next.hp, boss.hp);
    if (phaseNumber !== next.phaseNumber) {
      const wasSurge = phaseNumber > next.phaseNumber;
      next.phaseNumber = phaseNumber;
      if (now > 0 && wasSurge) {
        next.exposedUntil = Math.max(next.exposedUntil, now + 5000);
        next.bossSpecialAt = Math.max(next.bossSpecialAt, now + 2000);
        next.message = `⚠ ${boss.name}'s power surges — EXPOSED! Strike now!`;
      }
    }
  };

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
      const punchRank = techniqueRank(game, "punch");
      const windowMs = punchRank >= 2 ? 1050 : 950;
      const chainCap = punchRank >= 4 ? 10 : 8;
      next.combo = action.now - next.lastPunchAt < windowMs ? (next.combo % chainCap) + 1 : 1;
      next.lastPunchAt = action.now;
      next.meleeStreak += 1;
      next.kiStreak = 0;
      if (next.meleeStreak >= 4 && action.now > 0) next.adaptMeleeUntil = action.now + 2500; // boss can punish predictable rushing
      const bonus = 1 + Math.min(chainCap - 1, next.combo - 1) * 0.09;
      damageBoss((game.stats.strength * 2 + game.stats.agility) * multiplier * bonus);
      resolvePlayerDamage();
      return next;
    }
    case "HEAVY": {
      if (next.phase !== "active" || !boss) return next;
      next.combo = next.combo + 1;
      next.lastPunchAt = action.now ?? next.lastPunchAt;
      next.meleeStreak = 0;
      next.kiStreak = 0;
      const finisher = techniqueRank(game, "heavy") >= 2 ? 1.75 : 1.5;
      const heavyBonus = next.combo >= 4 ? finisher : 1;
      damageBoss((game.stats.strength * 3 + game.stats.agility * 1.5) * multiplier * heavyBonus);
      if (next.phase === "active") next.message = heavyBonus > 1 ? "Haymaker finisher!" : "Heavy Strike!";
      resolvePlayerDamage();
      refreshPhase();
      return next;
    }
    case "RESET_COMBO":
      if (action.now - next.lastPunchAt >= 1100) next.combo = 0;
      return next;
    case "BLAST": {
      if (next.phase !== "active" || !boss) return next;
      const blastCost = techniqueRank(game, "blast") >= 2 ? 15 : 20;
      if (!game.infiniteKi && next.ki < blastCost) return next;
      if (!game.infiniteKi) next.ki -= blastCost;
      next.kiStreak += 1;
      next.meleeStreak = 0;
      // Ki-assisted combo branch: blasting mid-combo amplifies damage.
      const comboAssist = next.combo >= 3 ? 1 + next.combo * 0.05 : 1;
      // Adaptive response: the boss anticipates Ki-spam and blunts it.
      const read = next.kiStreak >= 3 ? 0.75 : 1;
      damageBoss(game.stats.ki * 10 * multiplier * comboAssist * read);
      if (next.phase === "active" && read < 1) next.message = `${boss.name} anticipates your Ki blast!`;
      else if (next.phase === "active" && comboAssist > 1) next.message = "Ki-assisted combo!";
      resolvePlayerDamage();
      refreshPhase();
      return next;
    }
    case "ULTIMATE": {
      if (next.phase !== "active" || !boss || (!game.infiniteKi && next.ki < 100)) return next;
      if (!game.infiniteKi) next.ki = 0;
      next.kiStreak += 1;
      next.meleeStreak = 0;
      const finalStretch = next.combo >= 5 ? 1.25 : 1;
      damageBoss((game.stats.ki * 40 + game.stats.strength * 10) * multiplier * finalStretch);
      // Ki Overload: massive cast staggers you — the boss punishes openings for a bit.
      if (now > 0) next.overloadedUntil = now + (techniqueRank(game, "ultimate") >= 3 ? 1500 : 3000);
      if (next.phase === "active") next.message = finalStretch > 1 ? "FINAL STRETCH — FINAL FLASH! (you are vulnerable!)" : "Ki overloads! You are vulnerable!";
      resolvePlayerDamage();
      refreshPhase();
      return next;
    }
    case "VANISH": {
      if (next.phase !== "active" || !boss) return next;
      const vanishCost = techniqueRank(game, "vanish") >= 2 ? 12 : 15;
      if (!game.infiniteKi && next.ki < vanishCost) return next;
      if (!game.infiniteKi) next.ki -= vanishCost;
      next.meleeStreak = 0;
      next.kiStreak = 0;
      // Punish branch: vanishing mid-combo is a guaranteed gap-closer crit.
      const punish = next.combo >= 4 ? 1.5 : 1;
      damageBoss((game.stats.agility * 5 + game.stats.strength * 2) * multiplier * punish);
      if (next.phase === "active" && punish > 1) next.message = "Vanish punish!";
      resolvePlayerDamage();
      refreshPhase();
      return next;
    }
    case "PERFECT_GUARD": {
      if (next.phase !== "active" || !boss || now <= 0) return next;
      if (now < next.guardCdUntil) {
        next.message = "Guard recovering…";
        return next;
      }
      const uiForm = action.uiForm === true;
      const pRank = techniqueRank(game, "parry");
      next.guardUntil = now + (uiForm ? 750 : pRank >= 3 ? 550 : 450);
      next.guardCdUntil = now + (uiForm ? 800 : pRank >= 2 ? 800 : 1100);
      next.message = uiForm ? "Perfect guard — time slows! (Ultra Instinct)" : "Perfect guard stance…";
      return next;
    }
    case "CHARGE":
      if (next.phase === "active" && boss) {
        const chargeMult = techniqueRank(game, "charge") >= 2 ? 1.25 : 1;
        next.ki = Math.min(100, next.ki + action.amount * chargeMult);
      }
      return next;
    case "USE_CONSUMABLE": {
      if (next.phase !== "active" || !boss) return next;
      if (action.consumable === "senzu") {
        next.playerHp = next.maxPlayerHp;
        next.message = "Senzu bean! You are fully restored.";
      } else {
        next.ki = 100;
        next.message = "Energy tonic! Ki floods through you.";
      }
      return next;
    }
    case "CUSTOM_TECHNIQUE": {
      if (next.phase !== "active" || !boss) return next;
      const tech = game.customTechniques.find((t) => t.id === action.techniqueId);
      if (!tech) return next;
      const nowMs = now;
      if (nowMs > 0 && (next.cooldowns[tech.id] ?? 0) > nowMs) {
        next.message = `${tech.name} is recovering…`;
        return next;
      }
      if (!game.infiniteKi && next.ki < tech.kiCost) return next;
      if (!game.infiniteKi) next.ki -= tech.kiCost;
      const statTotal = tech.scale === "ki" ? game.stats.ki : tech.scale === "strength" ? game.stats.strength : tech.scale === "agility" ? game.stats.agility : game.stats.defense;
      // EXPOSED doubling is applied inside damageBoss for every attack — don't apply it twice here.
      damageBoss(statTotal * tech.mult * multiplier);
      if (next.phase === "active") next.message = `${tech.name}!`;
      if (nowMs > 0) next.cooldowns = { ...next.cooldowns, [tech.id]: nowMs + tech.cooldownMs };
      resolvePlayerDamage();
      return next;
    }
    case "ENEMY_TICK":
      if (next.phase !== "active" && next.phase !== "clash") return next;
      if (!boss) return next;
      if (!game.godMode) {
        const scale = phaseScale(next.phaseNumber);
        const defenseMult = 1 + equipmentBonus(game).defenseMult;
        let damage = Math.max(1, boss.atk * scale - game.stats.defense * defenseMult * multiplier * 0.5);
        if (next.phase === "clash") damage *= 0.35;
        const parried = now > 0 && now <= next.guardUntil;
        if (parried) {
          damage = 0;
          next.exposedUntil = Math.max(next.exposedUntil, now + 2500);
          next.message = `PARRY! ${boss.name} is overexposed — strike now!`;
        } else if (boss.signature && next.phaseNumber >= 2 && now > 0 && now >= next.bossSpecialAt) {
          damage = boss.atk * scale * boss.signature.mult;
          next.bossSpecialAt = now + 6000;
          next.message = `⚡ ${boss.name} unleashes ${boss.signature.name}!`;
        } else if (now > 0 && next.overloadedUntil > now) {
          damage *= 1.5;
          next.message = `${boss.name} punishes your Ki overload!`;
        } else if (now > 0 && next.adaptMeleeUntil >= now) {
          damage *= 1.35;
          next.adaptMeleeUntil = 0;
          next.message = `${boss.name} counters your predictable rush!`;
        }
        next.playerHp -= damage;
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
      refreshPhase();
      return next;
    case "CLASH_TICK":
      if (next.phase !== "clash") return next;
      next.clashProgress = Math.max(0, next.clashProgress - action.pressurePerSecond * action.deltaSeconds);
      if (next.clashProgress <= 0 || action.elapsedMs > 8000) {
        if (next.clashProgress >= 50) resolveClash(next, boss);
        else resolveClashLoss(next, boss);
      }
      refreshPhase();
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

/** Saga rank of a boss — drives clash pressure/delay scaling. Variant ids
 *  (endless-N, tournament-*, raid-*) resolve to the rank of their template. */
export function battleSagaRank(boss: Boss): number {
  const direct = BOSSES.findIndex((entry) => entry.id === boss.id);
  if (direct >= 0) return direct;
  if (typeof boss.tournament === "number") {
    const round = TOURNAMENT[boss.tournament];
    const idx = round ? BOSSES.findIndex((entry) => entry.id === round.bossId) : -1;
    if (idx >= 0) return idx;
  }
  const endless = /^endless-(\d+)$/.exec(boss.id);
  if (endless) {
    const wave = Math.max(1, Math.floor(Number(endless[1])));
    const baseId = ENDLESS_ROSTER[(wave - 1) % ENDLESS_ROSTER.length]!;
    const idx = BOSSES.findIndex((entry) => entry.id === baseId);
    if (idx >= 0) return idx;
  }
  const raid = RAID_BOSSES.find((r) => r.base.id === boss.id);
  if (raid) return BOSSES.length - 1; // raids sit at end-of-roster clash pressure
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
  for (const k of ["strength", "agility", "ki", "defense"] as StatKey[]) game.stats[k] = clampSaveNumber(game.stats[k] * factor, game.stats[k]);
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

/** Spawns a wave-scaled endless-survival boss built from the rotating roster. */
export function endlessBoss(wave: number, modifier: EndlessModifierId = "none"): Boss {
  const safeWave = Math.max(1, Math.floor(wave));
  const baseId = ENDLESS_ROSTER[(safeWave - 1) % ENDLESS_ROSTER.length]!;
  const template = BOSSES.find((b) => b.id === baseId)!;
  const mod = ENDLESS_MODIFIERS.find((m) => m.id === modifier) ?? ENDLESS_MODIFIERS[0]!;
  const hpScale = (1 + 0.6 * (safeWave - 1)) * (modifier === "heavyweight" ? 1.5 : 1);
  const atkScale = (1 + 0.45 * (safeWave - 1)) * (modifier === "aggression" ? 1.5 : 1);
  return {
    ...template,
    id: `endless-${safeWave}`,
    name: `Endless ${safeWave} — ${template.name}`,
    hp: Math.max(1, Math.floor(template.hp * hpScale)),
    atk: Math.max(1, Math.floor(template.atk * atkScale)),
    zeni: Math.floor((1500 + safeWave * 2500) * mod.rewardMult),
    tp: Math.max(1, Math.floor((safeWave / 2) * mod.rewardMult)),
    req: 0,
    endlessModifier: modifier,
  };
}

/** Pays endless-survival rewards for a wave and records the best cleared wave. */
export function applySurvivalRewards(d: GameState, boss: Boss): void {
  const wave = Math.max(1, Math.floor(Number(boss.id.split("-")[1]) || 1));
  d.zeni = clampSaveNumber(d.zeni + boss.zeni, d.zeni);
  d.tp = clampSaveNumber(d.tp + boss.tp, d.tp);
  logTransaction(d, "credit", "zeni", boss.zeni, `Endless Survival — Wave ${wave}`);
  logTransaction(d, "credit", "tp", boss.tp, `Endless Survival — Wave ${wave}`);
  if (wave > d.survivalBest) d.survivalBest = wave;
  grantExperience(d, 40 + wave * 40);
}

/** Pays raid rewards (full the first time, 15% after) and tracks first-clear Dragon Balls. */
export function applyRaidRewards(d: GameState, raidId: string): void {
  const raid = RAID_BOSSES.find((r) => r.id === raidId);
  if (!raid) return;
  const id = raid.base.id;
  const first = !d.defeated.includes(id);
  const zeni = first ? raid.zeni : Math.floor(raid.zeni * 0.15);
  const tp = first ? raid.tp : Math.floor(raid.tp * 0.15);
  d.zeni = clampSaveNumber(d.zeni + zeni, d.zeni);
  d.tp = clampSaveNumber(d.tp + tp, d.tp);
  if (first) d.defeated.push(id);
  if (first && raid.ballOnFirstClear) grantBall(d);
  logTransaction(d, "credit", "zeni", zeni, `Raid — ${raid.name}${first ? "" : " (rematch)"}`);
  logTransaction(d, "credit", "tp", tp, `Raid — ${raid.name}${first ? "" : " (rematch)"}`);
  grantExperience(d, first ? 1500 : 200);
}

export function countItem(d: GameState, id: string): number {
  const n = d.inventory[id];
  return typeof n === "number" && isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function consumeItem(d: GameState, id: string): boolean {
  const n = countItem(d, id);
  if (n <= 0) return false;
  if (n <= 1) delete d.inventory[id];
  else d.inventory[id] = n - 1;
  return true;
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

export function grantExperience(state: GameState, amount: number): void {
  state.xp = clampSaveNumber(state.xp + Math.max(0, Math.floor(amount)), state.xp);
  const nextLevel = levelForXp(state.xp);
  // Gravity adapts with the body: leveling up raises the chamber automatically.
  if (nextLevel > state.level) state.gravity = Math.max(state.gravity, maxGravityForLevel(nextLevel));
  state.level = nextLevel;
}

function applyTraining(state: GameState, stat: StatKey, rawGain: number, xpScale = 1): number {
  const gain = effectiveTrainingGain(state, stat, rawGain);
  state.stats[stat] = clampSaveNumber(state.stats[stat] + gain, state.stats[stat]);
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
    case "TICK": {
      d.maxStamina = Math.min(MAX_SAVE_NUMBER, 100 + Math.floor(d.stats.defense / 5) + Math.floor(d.maxStaminaBonus ?? 0));
      const regen = (2 + d.maxStamina * 0.02) * (d.passes.includes("vip") ? 2 : 1);
      d.stamina = Math.min(d.maxStamina, d.stamina + regen);
      if (d.passes.includes("auto")) {
        const rawGain = trainingGain(d);
        applyTraining(d, d.autoTarget, rawGain * 2, 0.25);
        d.zeni = clampSaveNumber(d.zeni + Math.ceil(rawGain), d.zeni);
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
    case "BUY_ITEM": {
      const equip = EQUIPMENT.find((e) => e.id === a.itemId);
      if (equip) {
        if (countItem(d, equip.id) > 0 || d.equipped.includes(equip.id) || d.zeni < equip.cost) return;
        d.zeni = clampSaveNumber(d.zeni - equip.cost, 0);
        logTransaction(d, "debit", "zeni", equip.cost, `Equipment — ${equip.name}`);
        d.inventory[equip.id] = 1;
        return;
      }
      const consumable = CONSUMABLES.find((c) => c.id === a.itemId);
      if (consumable) {
        if (d.zeni < consumable.cost) return;
        d.zeni = clampSaveNumber(d.zeni - consumable.cost, 0);
        logTransaction(d, "debit", "zeni", consumable.cost, `Item — ${consumable.name}`);
        d.inventory[consumable.id] = countItem(d, consumable.id) + 1;
      }
      return;
    }
    case "EQUIP_ITEM": {
      const equip = EQUIPMENT.find((e) => e.id === a.itemId);
      if (!equip || countItem(d, equip.id) <= 0) return;
      d.inventory[equip.id] = countItem(d, equip.id) - 1;
      if (d.inventory[equip.id] === 0) delete d.inventory[equip.id];
      // One item per slot: the currently-equipped piece in this slot returns to the bag.
      const current = d.equipped.find((id) => EQUIPMENT.find((e) => e.id === id)?.slot === equip.slot);
      if (current) {
        d.equipped = d.equipped.filter((id) => id !== current);
        d.inventory[current] = countItem(d, current) + 1;
      }
      d.equipped.push(equip.id);
      return;
    }
    case "UNEQUIP_ITEM": {
      if (!d.equipped.includes(a.itemId)) return;
      d.equipped = d.equipped.filter((id) => id !== a.itemId);
      d.inventory[a.itemId] = countItem(d, a.itemId) + 1;
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
      if (r < 0.05 + equipmentBonus(d).scoutBallBonus) grantBall(d);
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
    case "RECORD_BOSS_GRADE": {
      const entry = a.bossId.slice(0, 60);
      const current = d.bestGrades[entry];
      if (!current || GRADE_ORDER.indexOf(a.grade) > GRADE_ORDER.indexOf(current)) d.bestGrades[entry] = a.grade;
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
  // gravityProgress was removed — gravity now adapts automatically on level-up.
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
  // Inventory: item ids must exist in a registry; consumables cap at 999, gear at 1.
  out.inventory = {};
  if (r.inventory && typeof r.inventory === "object" && !Array.isArray(r.inventory)) {
    const EQUIP_IDS = new Set(EQUIPMENT.map((e) => e.id));
    const CONSUMABLE_IDS = new Set(CONSUMABLES.map((c) => c.id));
    for (const [id, qty] of Object.entries(r.inventory as Record<string, unknown>)) {
      if (typeof qty !== "number" || !isFinite(qty) || qty <= 0) continue;
      if (!EQUIP_IDS.has(id) && !CONSUMABLE_IDS.has(id)) continue;
      out.inventory[id] = EQUIP_IDS.has(id) ? 1 : Math.min(999, Math.floor(qty));
    }
  }
  // Equipped: unique ids, known equipment only, one item per slot.
  out.equipped = [];
  if (Array.isArray(r.equipped)) {
    const seen = new Set<string>();
    const slots = new Set<string>();
    for (const raw of r.equipped) {
      if (typeof raw !== "string" || seen.has(raw)) continue;
      const def = EQUIPMENT.find((e) => e.id === raw);
      if (!def || slots.has(def.slot)) continue;
      seen.add(raw); slots.add(def.slot); out.equipped.push(raw);
    }
  }
  // Technique counters: known ids only, clamped.
  const TECHNIQUE_IDS = new Set(["punch", "heavy", "blast", "ultimate", "vanish", "charge", "parry"]);
  out.techniqueUses = {};
  if (r.techniqueUses && typeof r.techniqueUses === "object" && !Array.isArray(r.techniqueUses)) {
    for (const [id, uses] of Object.entries(r.techniqueUses as Record<string, unknown>)) {
      if (!TECHNIQUE_IDS.has(id)) continue;
      const v = clampSaveNumber(uses, 0, 1_000_000);
      if (v > 0) out.techniqueUses[id] = Math.floor(v);
    }
  }
  out.survivalBest = Math.max(0, Math.min(9999, Math.floor(clampSaveNumber(r.survivalBest, 0, 9999))));
  out.infiniteKi = r.infiniteKi === true;
  // Custom techniques: strict shape enforcement — they execute in real combat.
  const TECH_SCALES: readonly CustomTechniqueScale[] = ["ki", "strength", "agility", "defense"];
  out.customTechniques = [];
  if (Array.isArray(r.customTechniques)) {
    for (const raw of r.customTechniques) {
      if (!raw || typeof raw !== "object") continue;
      const t = raw as Partial<CustomTechnique>;
      if (typeof t.id !== "string" || !t.id.startsWith("custom-tech-")) continue;
      if (typeof t.name !== "string" || !t.name.trim() || t.name.length > 40) continue;
      if (typeof t.desc !== "string") continue;
      if (!TECH_SCALES.includes(t.scale as CustomTechniqueScale)) continue;
      const mult = typeof t.mult === "number" && isFinite(t.mult) ? Math.max(0.1, Math.min(MAX_CUSTOM_TECHNIQUE_MULT, t.mult)) : 1;
      const kiCost = typeof t.kiCost === "number" && isFinite(t.kiCost) ? Math.max(0, Math.min(100, Math.floor(t.kiCost))) : 10;
      const cooldownMs = typeof t.cooldownMs === "number" && isFinite(t.cooldownMs) ? Math.max(0, Math.min(15000, Math.floor(t.cooldownMs))) : 1000;
      const aura = typeof t.aura === "string" && t.aura.length <= 40 ? t.aura : "#7c58ff";
      out.customTechniques.push({ id: t.id.slice(0, 48), name: t.name.trim(), desc: t.desc.slice(0, 200), scale: t.scale as CustomTechniqueScale, mult, kiCost, cooldownMs, aura });
      if (out.customTechniques.length >= MAX_CUSTOM_TECHNIQUES) break;
    }
  }
  // Admin event log: keep only well-formed rows, cap at 100.
  out.adminEvents = [];
  if (Array.isArray(r.adminEvents)) {
    for (const raw of r.adminEvents) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Partial<AdminEvent>;
      if (typeof e.id !== "string" || typeof e.at !== "number" || !isFinite(e.at)) continue;
      if (typeof e.action !== "string" || typeof e.target !== "string") continue;
      const outcome = e.outcome === "blocked" || e.outcome === "failed" ? e.outcome : "ok";
      out.adminEvents.push({
        id: e.id.slice(0, 64), at: Math.floor(e.at),
        action: e.action.slice(0, 60), target: e.target.slice(0, 120),
        previousValue: String(e.previousValue ?? "").slice(0, 120), newValue: String(e.newValue ?? "").slice(0, 120),
        outcome,
        ...(typeof e.detail === "string" ? { detail: e.detail.slice(0, 200) } : {}),
      });
      if (out.adminEvents.length >= 100) break;
    }
  }
  // Best combat grades: keep the highest letter grade per boss; drop duplicates and junk ranks.
  out.bestGrades = {};
  if (r.bestGrades && typeof r.bestGrades === "object" && !Array.isArray(r.bestGrades)) {
    for (const [bossId, grade] of Object.entries(r.bestGrades as Record<string, unknown>)) {
      if (typeof bossId === "string" && typeof grade === "string" && (GRADE_ORDER as readonly string[]).includes(grade)) {
        out.bestGrades[bossId.slice(0, 60)] = grade as BattleGrade;
      }
    }
  }
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
