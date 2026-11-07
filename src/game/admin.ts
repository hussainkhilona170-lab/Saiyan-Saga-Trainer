// Typed GOD ENGINE admin API. Pure, validated, logged. No React, no storage.
// Every privileged operation the God Engine exposes funnels through executeAdminAction,
// so extreme-number protection, audit logging and destructive-action flags are uniform.
import {
  BOSSES, LOCATIONS, QUESTS,
  type StatKey,
} from "./data";
import {
  allForms, clampSaveNumber, findForm, grantExperience, levelForXp, logTransaction,
  MAX_SAVE_NUMBER, powerLevel, xpRequiredForLevel, type GameState,
} from "./engine";
// re-use the engine's internal quest-claim path by dispatching a synthetic action is not
// possible from here; force-claims are reimplemented with the same validation.
export type AdminMode = "reality" | "sandbox" | "god";
export const adminModeOf = (state: GameState, slot: "main" | "sandbox"): AdminMode =>
  state.godMode ? "god" : slot === "sandbox" ? "sandbox" : "reality";

export type AdminAction =
  | { type: "SET_STAT"; stat: StatKey; value: number }
  | { type: "ADD_STAT"; stat: StatKey; delta: number }
  | { type: "SET_MASTERY"; stat: StatKey; value: number }
  | { type: "SET_LEVEL"; level: number }
  | { type: "SET_XP"; xp: number }
  | { type: "SET_POWER_LEVEL"; target: number }
  | { type: "SET_ZENI"; amount: number }
  | { type: "ADD_ZENI"; amount: number }
  | { type: "SET_TP"; amount: number }
  | { type: "ADD_TP"; amount: number }
  | { type: "SET_STAMINA"; value: number }
  | { type: "SET_GRAVITY"; gravity: number }
  | { type: "SET_DRAGON_BALLS"; count: number }
  | { type: "UNLOCK_FORM_ADMIN"; formId: string }
  | { type: "LOCK_FORM"; formId: string }
  | { type: "UNLOCK_ALL_FORMS" }
  | { type: "LOCK_ALL_FORMS" }
  | { type: "SET_ACTIVE_FORM"; formId: string }
  | { type: "TELEPORT"; locationId: string }
  | { type: "COMPLETE_QUEST"; questId: string | "all" }
  | { type: "RESET_QUEST"; questId: string | "all" }
  | { type: "UNLOCK_BOSS"; bossId: string }
  | { type: "SET_GOD_MODE"; flag: boolean }
  | { type: "SET_INFINITE_KI"; flag: boolean }
  | { type: "SET_INFINITE_ZENI"; flag: boolean }
  | { type: "SET_SURVIVAL_BEST"; wave: number }
  | { type: "SPAWN_BOSS"; bossId: string }
  | { type: "SNAPSHOT_CREATE"; name: string };

export type AdminOutcome = "ok" | "failed" | "blocked";
export type AdminResult = { ok: boolean; message: string; outcome: AdminOutcome; confirmRequired?: boolean };

const STAT_KEYS: readonly StatKey[] = ["strength", "agility", "ki", "defense"];
export const isStatKey = (k: string): k is StatKey => (STAT_KEYS as readonly string[]).includes(k);

/** Destructive actions the God Engine must confirm before executing. */
export function adminActionRequiresConfirmation(action: AdminAction): boolean {
  switch (action.type) {
    case "UNLOCK_ALL_FORMS":
    case "LOCK_ALL_FORMS":
    case "COMPLETE_QUEST":
    case "RESET_QUEST":
      return true;
    default:
      return false;
  }
}

function record(d: GameState, action: string, target: string, previousValue: unknown, newValue: unknown, outcome: AdminOutcome, at: number, detail?: string): void {
  d.adminEvents.push({
    id: `${at}-${d.adminEvents.length}`, at, action, target: String(target).slice(0, 120),
    previousValue: String(previousValue).slice(0, 120), newValue: String(newValue).slice(0, 120),
    outcome,
    ...(detail ? { detail: detail.slice(0, 200) } : {}),
  });
  if (d.adminEvents.length > 100) d.adminEvents.splice(0, d.adminEvents.length - 100);
}

const fmtN = (n: number): string => (Number.isFinite(n) ? Math.floor(n).toLocaleString("en-US") : "∞");
const finiteClamp = (n: number, max = MAX_SAVE_NUMBER): number => clampSaveNumber(n, 0, max);

/** Executes an admin action against the draft. All inputs are clamped; everything is logged. */
export function executeAdminAction(d: GameState, action: AdminAction, at = Date.now()): AdminResult {
  const ok = (message: string, extra?: Partial<AdminResult>): AdminResult => ({ ok: true, message, outcome: "ok", ...extra });
  const fail = (message: string): AdminResult => { record(d, action.type, targetOf(action), "", "", "failed", at, message); return { ok: false, message, outcome: "failed" }; };
  const block = (message: string): AdminResult => { record(d, action.type, targetOf(action), "", "", "blocked", at, message); return { ok: false, message, outcome: "blocked" }; };

  switch (action.type) {
    case "SET_STAT": {
      if (!isStatKey(action.stat)) return fail("Unknown stat");
      const prev = d.stats[action.stat];
      d.stats[action.stat] = finiteClamp(action.value, 1e15);
      record(d, action.type, action.stat, prev, d.stats[action.stat], "ok", at);
      return ok(`Stat ${action.stat} set to ${fmtN(d.stats[action.stat])}`);
    }
    case "ADD_STAT": {
      if (!isStatKey(action.stat)) return fail("Unknown stat");
      const prev = d.stats[action.stat];
      d.stats[action.stat] = finiteClamp(prev + (Number.isFinite(action.delta) ? action.delta : 0), 1e15);
      record(d, action.type, action.stat, prev, d.stats[action.stat], "ok", at);
      return ok(`Stat ${action.stat} ${action.delta >= 0 ? "+" : ""}${fmtN(Math.abs(action.delta))} → ${fmtN(d.stats[action.stat])}`);
    }
    case "SET_MASTERY": {
      if (!isStatKey(action.stat)) return fail("Unknown stat");
      const prev = d.mastery[action.stat];
      d.mastery[action.stat] = Math.max(0, Math.min(100, Number.isFinite(action.value) ? action.value : 0));
      record(d, action.type, action.stat, prev, d.mastery[action.stat], "ok", at);
      return ok(`Mastery ${action.stat} set to ${d.mastery[action.stat]}%`);
    }
    case "SET_LEVEL": {
      const level = Math.max(1, Math.min(100, Math.floor(Number.isFinite(action.level) ? action.level : 1)));
      const prev = d.level;
      d.level = level;
      d.xp = xpRequiredForLevel(level);
      record(d, action.type, "level", prev, level, "ok", at);
      return ok(`Level ${level} (XP synced to ${fmtN(d.xp)})`);
    }
    case "SET_XP": {
      const prev = d.xp;
      d.xp = finiteClamp(action.xp);
      d.level = levelForXp(d.xp);
      record(d, action.type, "xp", prev, d.xp, "ok", at);
      return ok(`XP set to ${fmtN(d.xp)} → Level ${d.level}`);
    }
    case "SET_POWER_LEVEL": {
      const target = finiteClamp(action.target, 1e15);
      const current = powerLevel(d);
      if (current <= 0) return fail("Cannot compute a scale from zero Power Level");
      const scale = target / current;
      for (const k of STAT_KEYS) d.stats[k] = finiteClamp(d.stats[k] * scale, 1e15);
      record(d, action.type, "powerLevel", current, powerLevel(d), "ok", at, `scale ×${scale.toFixed(4)}`);
      return ok(`Stats scaled ×${scale.toFixed(4)} → Power Level ${fmtN(powerLevel(d))}`);
    }
    case "SET_ZENI": {
      const prev = d.zeni;
      d.zeni = finiteClamp(action.amount);
      record(d, action.type, "zeni", prev, d.zeni, "ok", at);
      return ok(`Zeni set to ${fmtN(d.zeni)}`);
    }
    case "ADD_ZENI": {
      const prev = d.zeni;
      d.zeni = finiteClamp(d.zeni + action.amount);
      logTransaction(d, "credit", "zeni", Math.max(0, action.amount), "God Engine grant");
      record(d, action.type, "zeni", prev, d.zeni, "ok", at);
      return ok(`+${fmtN(Math.max(0, action.amount))} Zeni → ${fmtN(d.zeni)}`);
    }
    case "SET_TP": {
      const prev = d.tp;
      d.tp = finiteClamp(action.amount);
      record(d, action.type, "tp", prev, d.tp, "ok", at);
      return ok(`TP set to ${fmtN(d.tp)}`);
    }
    case "ADD_TP": {
      const prev = d.tp;
      d.tp = finiteClamp(d.tp + action.amount);
      logTransaction(d, "credit", "tp", Math.max(0, action.amount), "God Engine grant");
      record(d, action.type, "tp", prev, d.tp, "ok", at);
      return ok(`+${fmtN(Math.max(0, action.amount))} TP → ${fmtN(d.tp)}`);
    }
    case "SET_STAMINA": {
      const prev = d.stamina;
      d.maxStamina = Math.max(1, Math.min(MAX_SAVE_NUMBER, d.maxStamina));
      d.stamina = Math.max(0, Math.min(d.maxStamina, finiteClamp(action.value, d.maxStamina)));
      record(d, action.type, "stamina", prev, d.stamina, "ok", at);
      return ok(`Stamina set to ${fmtN(d.stamina)}/${fmtN(d.maxStamina)}`);
    }
    case "SET_GRAVITY": {
      const prev = d.gravity;
      d.gravity = Math.max(1, Math.min(1000, Math.floor(Number.isFinite(action.gravity) ? action.gravity : 1)));
      d.gravityProgress = 0;
      record(d, action.type, "gravity", prev, d.gravity, "ok", at);
      return ok(`Gravity set to ${d.gravity}×`);
    }
    case "SET_DRAGON_BALLS": {
      const prev = d.dragonBalls;
      d.dragonBalls = Math.max(0, Math.min(7, Math.floor(Number.isFinite(action.count) ? action.count : 0)));
      record(d, action.type, "dragonBalls", prev, d.dragonBalls, "ok", at);
      return ok(`Dragon Balls set to ${d.dragonBalls}/7`);
    }
    case "UNLOCK_FORM_ADMIN": {
      const form = findForm(d, action.formId);
      if (!form) return block("Unknown form");
      if (d.forms.includes(form.id)) return ok(`Already owned: ${form.name}`);
      d.forms.push(form.id);
      record(d, action.type, form.id, "locked", "unlocked", "ok", at);
      return ok(`Unlocked: ${form.name}`);
    }
    case "LOCK_FORM": {
      const form = findForm(d, action.formId);
      if (!form) return fail("Unknown form");
      if (form.id === "base") return block("Base Form cannot be locked");
      const owned = d.forms.includes(form.id);
      d.forms = d.forms.filter((id) => id !== form.id);
      if (d.activeForm === form.id) d.activeForm = "base";
      record(d, action.type, form.id, owned ? "unlocked" : "already locked", "locked", "ok", at);
      return ok(`Locked: ${form.name}`);
    }
    case "UNLOCK_ALL_FORMS": {
      const ids = allForms(d).map((f) => f.id);
      const before = d.forms.length;
      d.forms = [...new Set([...d.forms, ...ids])];
      record(d, action.type, "all forms", before, d.forms.length, "ok", at, "confirm required by caller");
      return ok(`Unlocked every form (${d.forms.length} total)`, { confirmRequired: true });
    }
    case "LOCK_ALL_FORMS": {
      const before = d.forms.length;
      d.forms = ["base"];
      d.activeForm = "base";
      record(d, action.type, "all forms", before, 1, "ok", at, "confirm required by caller");
      return ok("All forms locked — back to Base", { confirmRequired: true });
    }
    case "SET_ACTIVE_FORM": {
      const form = findForm(d, action.formId);
      if (!form) return fail("Unknown form");
      if (!d.forms.includes(form.id)) return block("Form not owned");
      const prev = d.activeForm;
      d.activeForm = form.id;
      record(d, action.type, form.id, prev, form.id, "ok", at);
      return ok(`Form set to ${form.name}`);
    }
    case "TELEPORT": {
      const loc = LOCATIONS.find((l) => l.id === action.locationId);
      if (!loc) return block("Unknown location");
      const prev = d.location;
      d.location = loc.id;
      record(d, action.type, loc.id, prev, loc.id, "ok", at);
      return ok(`Teleported to ${loc.name}`);
    }
    case "COMPLETE_QUEST": {
      const targets = action.questId === "all" ? QUESTS.map((q) => q.id) : [action.questId];
      let paid = 0;
      for (const questId of targets) {
        const quest = QUESTS.find((q) => q.id === questId);
        if (!quest || d.quests.includes(quest.id)) continue;
        d.quests.push(quest.id);
        d.zeni = finiteClamp(d.zeni + quest.zeni);
        d.tp = finiteClamp(d.tp + quest.tp);
        logTransaction(d, "credit", "zeni", quest.zeni, `God Engine — quest ${quest.title}`);
        logTransaction(d, "credit", "tp", quest.tp, `God Engine — quest ${quest.title}`);
        grantExperience(d, 25 + quest.tp * 2);
        paid++;
        record(d, action.type, quest.id, "unclaimed", "claimed", "ok", at);
      }
      return ok(`Quest${targets.length > 1 ? "s" : ""} completed and claimed: ${paid}`, { confirmRequired: true });
    }
    case "RESET_QUEST": {
      const targets = action.questId === "all" ? [...d.quests] : [action.questId];
      const before = d.quests.length;
      d.quests = d.quests.filter((q) => !targets.includes(q));
      record(d, action.type, action.questId, before, d.quests.length, "ok", at, "rewards are NOT refunded");
      return ok(`Quest progress reset (${before - d.quests.length} quests). Rewards were not refunded.`, { confirmRequired: true });
    }
    case "UNLOCK_BOSS": {
      const boss = BOSSES.find((b) => b.id === action.bossId);
      if (!boss) return fail("Unknown boss");
      // "Unlocking" a boss means marking it defeated so quest-gated content opens, plus we log it clearly.
      const already = d.defeated.includes(boss.id);
      if (!already) d.defeated.push(boss.id);
      record(d, action.type, boss.id, already ? "already marked" : "not marked", "defeated", "ok", at, "marks the boss defeated for quest progress");
      return ok(already ? `${boss.name} was already marked defeated` : `Marked ${boss.name} as defeated`);
    }
    case "SET_GOD_MODE": {
      const prev = d.godMode;
      d.godMode = action.flag;
      record(d, action.type, "godMode", prev, d.godMode, "ok", at);
      return ok(`God Mode ${d.godMode ? "ENABLED" : "disabled"}${d.godMode ? " — no damage, no costs" : ""}`);
    }
    case "SET_INFINITE_KI": {
      const prev = d.infiniteKi;
      d.infiniteKi = action.flag;
      record(d, action.type, "infiniteKi", prev, d.infiniteKi, "ok", at);
      return ok(`Infinite Ki ${d.infiniteKi ? "ENABLED" : "disabled"}`);
    }
    case "SET_INFINITE_ZENI": {
      const prev = d.infiniteZeni;
      d.infiniteZeni = action.flag;
      record(d, action.type, "infiniteZeni", prev, d.infiniteZeni, "ok", at);
      return ok(`Infinite Zeni ${d.infiniteZeni ? "ENABLED" : "disabled"}`);
    }
    case "SET_SURVIVAL_BEST": {
      const prev = d.survivalBest;
      d.survivalBest = Math.max(0, Math.min(9999, Math.floor(action.wave)));
      record(d, action.type, "survivalBest", prev, d.survivalBest, "ok", at);
      return ok(`Endless Survival best set to Wave ${d.survivalBest}`);
    }
    case "SPAWN_BOSS": {
      const boss = BOSSES.find((b) => b.id === action.bossId);
      if (!boss && !action.bossId.startsWith("raid-") && !action.bossId.startsWith("endless-") && !action.bossId.startsWith("tournament-")) {
        return fail("Unknown boss id");
      }
      record(d, action.type, action.bossId, "", "spawn", "ok", at, "routed to battle via command bus");
      return ok(`Spawn request routed to the battle tab: ${action.bossId}`);
    }
    case "SNAPSHOT_CREATE": {
      // Snapshot persistence is module-level (snapshots.ts); console surfaces the CTA instead.
      record(d, action.type, action.name, "", "queued", "ok", at, "snapshot handled by snapshot manager");
      return ok(`Snapshot "${action.name}" queued`);
    }
  }
}

function targetOf(action: AdminAction): string {
  switch (action.type) {
    case "SET_STAT":
    case "ADD_STAT":
    case "SET_MASTERY":
      return action.stat;
    default:
      return action.type;
  }
}

/** Read-only state summary for the Overview module and `player.inspect`. */
export function inspectPlayer(s: GameState): string {
  const sl = ["strength", "agility", "ki", "defense"] as StatKey[];
  return [
    `Level ${s.level} (${s.xp} XP) · Power Level ${powerLevel(s)}`,
    `Stats — ${sl.map((k) => `${k}: ${Math.floor(s.stats[k])}`).join(", ")}`,
    `Mastery — ${sl.map((k) => `${k}: ${Math.floor(s.mastery[k])}%`).join(", ")}`,
    `Resources — Zeni ${Math.floor(s.zeni)} · TP ${Math.floor(s.tp)} · Stamina ${Math.floor(s.stamina)}/${s.maxStamina} · Balls ${s.dragonBalls}/7`,
    `Form ${s.activeForm} · Gravity ${s.gravity}× · Location ${s.location}`,
    `Overrides — godMode:${s.godMode} infiniteKi:${s.infiniteKi} infiniteZeni:${s.infiniteZeni}`,
  ].join("\n");
}

// GRADE_ORDER re-exported for admin UI convenience.
export { GRADE_ORDER } from "./engine";
