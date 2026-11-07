// God Engine command console: strict parser + autocomplete registry. No eval, ever.
// Every command maps onto real admin actions; bad input is rejected with a reason.
import { BOSSES, FORMS, LOCATIONS, PASSES, QUESTS, type StatKey } from "./data";
import { findForm, powerLevel, type GameState } from "./engine";
import { isStatKey, type AdminAction } from "./admin";

export type ConsoleOutcome = { ok: boolean; message: string; action?: AdminAction };

const ok = (message: string, action?: AdminAction): ConsoleOutcome => action === undefined ? { ok: true, message } : { ok: true, message, action };
const err = (message: string): ConsoleOutcome => ({ ok: false, message });

const boolArg = (raw: string | undefined): boolean | null => {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (["true", "on", "yes", "1"].includes(v)) return true;
  if (["false", "off", "no", "0"].includes(v)) return false;
  return null;
};
const numArg = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const findId = <T extends { id: string }>(items: readonly T[], query: string | undefined): T | null => {
  if (!query) return null;
  const q = query.toLowerCase();
  return items.find((x) => x.id.toLowerCase() === q) ?? items.find((x) => x.id.toLowerCase().includes(q)) ?? null;
};

export type ConsoleEntry = { name: string; usage: string; desc: string };
export const COMMANDS: readonly ConsoleEntry[] = [
  { name: "help", usage: "help [filter]", desc: "List commands, optionally filtered" },
  { name: "ping", usage: "ping", desc: "Check the console is alive" },
  { name: "player.inspect", usage: "player.inspect", desc: "Dump a full character sheet" },
  { name: "player.setStat", usage: "player.setStat <strength|agility|ki|defense> <value>", desc: "Set an attribute" },
  { name: "player.addStat", usage: "player.addStat <stat> <delta>", desc: "Add to an attribute" },
  { name: "player.setLevel", usage: "player.setLevel <1-100>", desc: "Set level (XP follows)" },
  { name: "player.setXp", usage: "player.setXp <amount>", desc: "Set XP (level follows)" },
  { name: "player.setPowerLevel", usage: "player.setPowerLevel <target>", desc: "Scale all stats to hit a Power Level" },
  { name: "player.setMastery", usage: "player.setMastery <stat> <0-100>", desc: "Set stat mastery" },
  { name: "player.grantZeni", usage: "player.grantZeni <amount>", desc: "Grant Zeni (logged)" },
  { name: "player.takeZeni", usage: "player.takeZeni <amount>", desc: "Remove Zeni" },
  { name: "player.grantTP", usage: "player.grantTP <amount>", desc: "Grant TP Medals (logged)" },
  { name: "player.takeTP", usage: "player.takeTP <amount>", desc: "Remove TP Medals" },
  { name: "player.unlockForm", usage: "player.unlockForm <formId|name>", desc: "Force-unlock a form" },
  { name: "player.unlockAllForms", usage: "player.unlockAllForms", desc: "Unlock every transformation (confirm)" },
  { name: "player.lockAllForms", usage: "player.lockAllForms", desc: "Lock everything except Base (confirm)" },
  { name: "player.setGodMode", usage: "player.setGodMode <true|false>", desc: "Invulnerability + zero costs" },
  { name: "player.setInfiniteKi", usage: "player.setInfiniteKi <true|false>", desc: "Ki attacks cost nothing" },
  { name: "player.setInfiniteZeni", usage: "player.setInfiniteZeni <true|false>", desc: "Infinite Zeni override" },
  { name: "player.setGravity", usage: "player.setGravity <1-1000>", desc: "Set gravity chamber multiplier" },
  { name: "player.setDragonBalls", usage: "player.setDragonBalls <0-7>", desc: "Set Dragon Ball count" },
  { name: "quest.complete", usage: "quest.complete <questId|all>", desc: "Complete and claim quests (confirm)" },
  { name: "quest.reset", usage: "quest.reset <questId|all>", desc: "Reset quest claims — rewards NOT refunded (confirm)" },
  { name: "world.teleport", usage: "world.teleport <locationId>", desc: `Teleport: ${LOCATIONS.map((l) => l.id).join(", ")}` },
  { name: "battle.spawnBoss", usage: "battle.spawnBoss <bossId>", desc: `Spawn: ${[...BOSSES.map((b) => b.id), ...["broly", "janemba"].map((r) => `raid-${r}`), "endless-<wave>"].join(", ")}` },
  { name: "sandbox.snapshot", usage: "sandbox.snapshot create <name>", desc: "Create a named snapshot (handled by snapshot manager)" },
  { name: "system.version", usage: "system.version", desc: "Print build info" },
];

export function consoleSuggestions(prefix: string): ConsoleEntry[] {
  const q = prefix.trim().toLowerCase();
  if (!q) return COMMANDS.slice();
  return COMMANDS.filter((c) => c.name.toLowerCase().startsWith(q));
}

/** Parses and validates console input. The caller confirms any `confirmRequired` effects before running. */
export function parseAdminCommand(input: string, state: GameState): ConsoleOutcome {
  const trimmed = input.trim();
  if (!trimmed) return err("Type a command — try `help`.");
  const parts = trimmed.split(/\s+/);
  const [name, ...args] = parts;
  if (!name) return err("Type a command — try `help`.");
  const cmd = name.toLowerCase();

  switch (cmd) {
    case "help": {
      const filter = args[0]?.toLowerCase();
      const lines = COMMANDS.filter((c) => !filter || c.name.toLowerCase().includes(filter));
      if (lines.length === 0) return err(`No commands match "${filter}"`);
      return ok("Commands:\n" + lines.map((c) => `  ${c.name.padEnd(24)} ${c.usage}`).join("\n"));
    }
    case "ping":
      return ok("pong — console online");
    case "player.inspect": {
      const stats = (["strength", "agility", "ki", "defense"] as StatKey[]).map((k) => `${k} ${Math.floor(state.stats[k])}`).join(" · ");
      return ok(
        `Level ${state.level} · XP ${Math.floor(state.xp)} · Power Level ${powerLevel(state)}\n` +
        `${stats}\nBalls ${state.dragonBalls}/7 · Zeni ${Math.floor(state.zeni)} · TP ${Math.floor(state.tp)}\nOverrides: godMode=${state.godMode} infiniteKi=${state.infiniteKi} infiniteZeni=${state.infiniteZeni}`,
      );
    }
    case "player.setstat": {
      const stat = args[0]?.toLowerCase();
      if (!stat || !isStatKey(stat)) return err(`stat must be one of strength|agility|ki|defense`);
      const value = numArg(args[1]);
      if (value === null) return err("value must be a non-negative number");
      return ok(`set ${stat} → ${Math.floor(value)}`, { type: "SET_STAT", stat, value });
    }
    case "player.addstat": {
      const stat = args[0]?.toLowerCase();
      if (!stat || !isStatKey(stat)) return err("stat must be one of strength|agility|ki|defense");
      const raw = args[1];
      const delta = raw === undefined || isNaN(Number(raw)) ? null : Number(raw);
      if (delta === null) return err("delta must be a number (negative allowed)");
      return ok(`add ${delta >= 0 ? "+" : ""}${delta} ${stat}`, { type: "ADD_STAT", stat, delta });
    }
    case "player.setlevel": {
      const n = numArg(args[0]);
      if (n === null || n < 1 || n > 100) return err("level must be between 1 and 100");
      return ok(`set level ${Math.floor(n)}`, { type: "SET_LEVEL", level: Math.floor(n) });
    }
    case "player.setxp": {
      const n = numArg(args[0]);
      if (n === null) return err("xp must be a non-negative number");
      return ok(`set XP ${Math.floor(n)}`, { type: "SET_XP", xp: Math.floor(n) });
    }
    case "player.setpowerlevel": {
      const n = numArg(args[0]);
      if (n === null) return err("target must be a non-negative number");
      return ok(`scaling stats toward Power Level ${Math.floor(n)}`, { type: "SET_POWER_LEVEL", target: n });
    }
    case "player.setmastery": {
      const stat = args[0]?.toLowerCase();
      if (!stat || !isStatKey(stat)) return err("stat must be one of strength|agility|ki|defense");
      const n = numArg(args[1]);
      if (n === null || n > 100) return err("mastery must be between 0 and 100");
      return ok(`set ${stat} mastery ${Math.floor(n)}%`, { type: "SET_MASTERY", stat, value: n });
    }
    case "player.grantzeni": {
      const n = numArg(args[0]);
      if (n === null) return err("amount must be a non-negative number");
      return ok(`grant ${Math.floor(n)} Zeni`, { type: "ADD_ZENI", amount: Math.floor(n) });
    }
    case "player.takezeni": {
      const n = numArg(args[0]);
      if (n === null) return err("amount must be a non-negative number");
      return ok(`remove ${Math.floor(n)} Zeni`, { type: "SET_ZENI", amount: Math.max(0, state.zeni - Math.floor(n)) });
    }
    case "player.granttp": {
      const n = numArg(args[0]);
      if (n === null) return err("amount must be a non-negative number");
      return ok(`grant ${Math.floor(n)} TP`, { type: "ADD_TP", amount: Math.floor(n) });
    }
    case "player.taketp": {
      const n = numArg(args[0]);
      if (n === null) return err("amount must be a non-negative number");
      return ok(`remove ${Math.floor(n)} TP`, { type: "SET_TP", amount: Math.max(0, state.tp - Math.floor(n)) });
    }
    case "player.unlockform": {
      const query = args[0];
      const form = FORMS.find((f) => f.id === query?.toLowerCase()) ?? FORMS.find((f) => f.name.toLowerCase().includes(query?.toLowerCase() ?? ""));
      if (!form && query) {
        const dyn = findForm(state, query);
        if (dyn) return ok(`unlock ${dyn.name}`, { type: "UNLOCK_FORM_ADMIN", formId: dyn.id });
        return err(`unknown form "${query}"`);
      }
      if (!form) return err("expected a form id or name, e.g. player.unlockForm ssj2");
      return ok(`unlock ${form.name}`, { type: "UNLOCK_FORM_ADMIN", formId: form.id });
    }
    case "player.unlockallforms":
      return ok("unlock every form (confirm on apply)", { type: "UNLOCK_ALL_FORMS" });
    case "player.lockallforms":
      return ok("lock all except Base (confirm on apply)", { type: "LOCK_ALL_FORMS" });
    case "player.setgodmode": {
      const flag = boolArg(args[0]);
      if (flag === null) return err("expected true|false");
      return ok(`godMode → ${flag}`, { type: "SET_GOD_MODE", flag });
    }
    case "player.setinfiniteki": {
      const flag = boolArg(args[0]);
      if (flag === null) return err("expected true|false");
      return ok(`infiniteKi → ${flag}`, { type: "SET_INFINITE_KI", flag });
    }
    case "player.setinfinitezeni": {
      const flag = boolArg(args[0]);
      if (flag === null) return err("expected true|false");
      return ok(`infiniteZeni → ${flag}`, { type: "SET_INFINITE_ZENI", flag });
    }
    case "player.setgravity": {
      const n = numArg(args[0]);
      if (n === null || n < 1 || n > 1000) return err("gravity must be 1-1000");
      return ok(`gravity → ${Math.floor(n)}×`, { type: "SET_GRAVITY", gravity: Math.floor(n) });
    }
    case "player.setdragonballs": {
      const n = numArg(args[0]);
      if (n === null || n > 7) return err("dragon balls must be 0-7");
      return ok(`dragon balls → ${Math.floor(n)}/7`, { type: "SET_DRAGON_BALLS", count: Math.floor(n) });
    }
    case "quest.complete": {
      const target = args[0]?.toLowerCase();
      if (!target) return err("expected questId or all");
      if (target === "all") return ok("complete and claim all quests (confirm on apply)", { type: "COMPLETE_QUEST", questId: "all" });
      const quest = findId(QUESTS, target);
      if (!quest) return err(`unknown quest "${target}"`);
      return ok(`complete and claim ${quest.id} (confirm on apply)`, { type: "COMPLETE_QUEST", questId: quest.id });
    }
    case "quest.reset": {
      const target = args[0]?.toLowerCase();
      if (!target) return err("expected questId or all");
      if (target === "all") return ok("reset all quest claims (rewards NOT refunded)", { type: "RESET_QUEST", questId: "all" });
      const quest = findId(QUESTS, target);
      if (!quest) return err(`unknown quest "${target}"`);
      return ok(`reset claim for ${quest.id}`, { type: "RESET_QUEST", questId: quest.id });
    }
    case "world.teleport": {
      const loc = findId(LOCATIONS, args[0]?.toLowerCase());
      if (!loc) return err(`unknown location "${args[0] ?? ""}". Known: ${LOCATIONS.map((l) => l.id).join(", ")}`);
      return ok(`teleport → ${loc.name}`, { type: "TELEPORT", locationId: loc.id });
    }
    case "battle.spawnboss": {
      const query = args[0]?.toLowerCase();
      if (!query) return err("expected a boss id, e.g. battle.spawnBoss vegeta");
      const boss = findId(BOSSES, query);
      if (boss) return ok(`spawn ${boss.name}`, { type: "SPAWN_BOSS", bossId: boss.id });
      if (/^endless-\d+$/.test(query) || /^raid-(broly|janemba)$/.test(query) || /^tournament-r[1-4]$/.test(query)) {
        return ok(`spawn ${query}`, { type: "SPAWN_BOSS", bossId: query });
      }
      return err(`unknown boss "${query}". Known: ${[...BOSSES.map((b) => b.id), "raid-broly", "raid-janemba", "endless-<wave>"].join(", ")}`);
    }
    case "sandbox.snapshot": {
      if (args[0]?.toLowerCase() !== "create" || !args[1]) return err("usage: sandbox.snapshot create <name>");
      const name = args.slice(1).join(" ").slice(0, 60);
      return ok(`snapshot "${name}" queued`, { type: "SNAPSHOT_CREATE", name });
    }
    case "system.version":
      return ok("Saiyan Training Sim — build phase-7 (SAVE_VERSION 2, form 9, quests v2)");
    default:
      return err(`unknown command "${name}" — type help`);
  }
}
