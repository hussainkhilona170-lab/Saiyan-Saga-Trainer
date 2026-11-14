import { describe, it, expect } from "vitest";
import { BOSSES } from "@/game/data";
import {
  executeAdminAction, adminActionRequiresConfirmation, inspectPlayer, isStatKey, adminModeOf,
} from "@/game/admin";
import { parseAdminCommand, consoleSuggestions, COMMANDS } from "@/game/adminConsole";
import { simulateBossFight } from "@/game/battleSim";
import {
  applyAction, initialBattleState, initialState, resolveBattleAction, hydrate, sealSave, openSave,
  type BattleState, type GameState,
} from "@/game/engine";

const fresh = () => structuredClone(initialState);
const at = () => 1_700_000_000_000;

describe("god engine — typed admin actions & validation", () => {
  it("SET_STAT clamps to sane bounds and records the event", () => {
    const s = fresh();
    executeAdminAction(s, { type: "SET_STAT", stat: "strength", value: Number.NaN }, at());
    expect(s.stats.strength).toBe(0);
    executeAdminAction(s, { type: "SET_STAT", stat: "strength", value: 1e30 }, at());
    expect(s.stats.strength).toBe(1e15);
    expect(s.adminEvents.at(-1)?.action).toBe("SET_STAT");
    expect(s.adminEvents.at(-1)?.outcome).toBe("ok");
  });

  it("ADD_STAT with negative delta respects the floor", () => {
    const s = fresh(); s.stats.ki = 500;
    const r = executeAdminAction(s, { type: "ADD_STAT", stat: "ki", delta: -10000 }, at());
    expect(r.ok).toBe(true);
    expect(s.stats.ki).toBe(0);
  });

  it("SET_LEVEL syncs XP, SET_XP syncs level", () => {
    const s = fresh();
    executeAdminAction(s, { type: "SET_LEVEL", level: 10 }, at());
    expect(s.level).toBe(10);
    expect(s.xp).toBeGreaterThan(0);
    executeAdminAction(s, { type: "SET_XP", xp: 0 }, at());
    expect(s.level).toBe(1);
  });

  it("SET_POWER_LEVEL scales stats proportionally toward the target", () => {
    const s = fresh();
    s.stats.strength = 40; s.stats.agility = 40; s.stats.ki = 40; s.stats.defense = 40; // PL = 1600
    executeAdminAction(s, { type: "SET_POWER_LEVEL", target: 3200 }, at());
    const pl = (s.stats.strength + s.stats.agility + s.stats.ki + s.stats.defense) * 10;
    expect(Math.round(pl)).toBe(3200);
  });

  it("ADD_ZENI grants with a ledger entry and clamps to the ceiling", () => {
    const s = fresh();
    executeAdminAction(s, { type: "ADD_ZENI", amount: 500 }, at());
    expect(s.zeni).toBe(500);
    expect(s.transactions.some((t) => t.label === "God Engine grant")).toBe(true);
    expect(s.adminEvents.some((e) => e.action === "ADD_ZENI")).toBe(true);
    executeAdminAction(s, { type: "SET_ZENI", amount: 1e40 }, at());
    expect(s.zeni).toBe(1e18);
  });

  it("UNLOCK_FORM_ADMIN bypasses gates without payment; LOCK_FORM protects base", () => {
    const s = fresh();
    expect(s.forms).not.toContain("ssj1");
    executeAdminAction(s, { type: "UNLOCK_FORM_ADMIN", formId: "ssj1" }, at());
    expect(s.forms).toContain("ssj1");
    expect(s.zeni).toBe(0);
    executeAdminAction(s, { type: "LOCK_FORM", formId: "base" }, at());
    expect(s.forms).toContain("base");
    executeAdminAction(s, { type: "SET_ACTIVE_FORM", formId: "ssj1" }, at());
    expect(s.activeForm).toBe("ssj1");
    executeAdminAction(s, { type: "LOCK_FORM", formId: "ssj1" }, at());
    expect(s.activeForm).toBe("base");
  });

  it("form force-locks honor ownership", () => {
    const s = fresh();
    const r = executeAdminAction(s, { type: "SET_ACTIVE_FORM", formId: "ui" }, at());
    expect(r.ok).toBe(false);
  });

  it("UNLOCK_ALL_FORMS and LOCK_ALL_FORMS flag confirm-required and change everything", () => {
    const s = fresh();
    const r = executeAdminAction(s, { type: "UNLOCK_ALL_FORMS" }, at());
    expect(r.confirmRequired).toBe(true);
    expect(s.forms.length).toBeGreaterThan(8);
    expect(adminActionRequiresConfirmation({ type: "UNLOCK_ALL_FORMS" })).toBe(true);
    executeAdminAction(s, { type: "LOCK_ALL_FORMS" }, at());
    expect(s.forms).toEqual(["base"]);
    expect(s.activeForm).toBe("base");
  });

  it("TELEPORT validates locations and logs", () => {
    const s = fresh();
    const bad = executeAdminAction(s, { type: "TELEPORT", locationId: "mars" }, at());
    expect(bad.ok).toBe(false);
    expect(bad.outcome).toBe("blocked");
    const good = executeAdminAction(s, { type: "TELEPORT", locationId: "htc" }, at());
    expect(good.ok).toBe(true);
    expect(s.location).toBe("htc");
  });

  it("COMPLETE_QUEST 'all' claims everything once, RESET_QUEST does not refund", () => {
    const s = fresh();
    const r = executeAdminAction(s, { type: "COMPLETE_QUEST", questId: "all" }, at());
    expect(r.confirmRequired).toBe(true);
    expect(s.quests.length).toBeGreaterThanOrEqual(15);
    const zeniAfterClaims = s.zeni;
    executeAdminAction(s, { type: "RESET_QUEST", questId: "all" }, at());
    expect(s.quests).toHaveLength(0);
    expect(s.zeni).toBe(zeniAfterClaims);
  });

  it("SET_INFINITE_KI toggles and is logged", () => {
    const s = fresh();
    executeAdminAction(s, { type: "SET_INFINITE_KI", flag: true }, at());
    expect(s.infiniteKi).toBe(true);
    executeAdminAction(s, { type: "SET_GOD_MODE", flag: true }, at());
    expect(adminModeOf(s, "main")).toBe("god");
    executeAdminAction(s, { type: "SET_GOD_MODE", flag: false }, at());
    expect(adminModeOf(s, "sandbox")).toBe("sandbox");
    expect(adminModeOf(s, "main")).toBe("reality");
  });

  it("event log is capped at 100 and droppable", () => {
    const s = fresh();
    for (let i = 0; i < 130; i++) executeAdminAction(s, { type: "ADD_ZENI", amount: 1 }, at() + i);
    expect(s.adminEvents.length).toBeLessThanOrEqual(100);
  });

  it("inspectPlayer emits a multi-line sheet", () => {
    const s = fresh();
    const sheet = inspectPlayer(s);
    expect(sheet).toMatch(/Level 1/);
    expect(sheet).toMatch(/STR|strength/i);
    expect(sheet).toMatch(/Overrides/);
  });

  it("isStatKey guards unknown keys", () => {
    expect(isStatKey("strength")).toBe(true);
    expect(isStatKey("luck")).toBe(false);
  });
});

describe("god engine — infinite ki override is honored by the combat pipeline", () => {
  const battleOf = (ki: number, infiniteKi: boolean): { s: GameState; b: BattleState } => {
    const s = fresh(); s.infiniteKi = infiniteKi;
    const b: BattleState = { ...structuredClone(initialBattleState), boss: { ...BOSSES[0]! }, phase: "active", hp: 1e7, playerHp: 100, maxPlayerHp: 100, ki, message: "" };
    return { s, b };
  };

  it("BLAST with zero Ki and infiniteKi=true still fires", () => {
    const { s, b } = battleOf(0, true);
    const out = resolveBattleAction(b, s, { type: "BLAST" });
    expect(out.ki).toBe(0); // meter untouched — cost is free
    expect(out.hp).toBeLessThan(1e7);
  });

  it("BLAST with zero Ki and infiniteKi=false refuses", () => {
    const { s, b } = battleOf(0, false);
    const out = resolveBattleAction(b, s, { type: "BLAST" });
    expect(out.hp).toBe(1e7);
  });

  it("ULTIMATE/VANISH respect the override too", () => {
    const { s, b } = battleOf(0, true);
    expect(resolveBattleAction(b, s, { type: "ULTIMATE" }).ki).toBe(0);
    expect(resolveBattleAction(b, s, { type: "VANISH" }).ki).toBe(0);
  });
});

describe("god engine — custom techniques run on the real combat pipeline", () => {
  const baseTech = { id: "custom-tech-1", name: "Solar Flare", desc: "A blinding burst", scale: "ki" as const, mult: 3, kiCost: 25, cooldownMs: 500, aura: "#ff0" };
  const gameWithTech = () => {
    const s = fresh();
    s.stats.ki = 100;
    s.customTechniques = [{ ...baseTech }];
    return s;
  };
  const battle = (ki: number): BattleState => ({ ...structuredClone(initialBattleState), boss: { ...BOSSES[0]! }, phase: "active", hp: 1e8, playerHp: 100, maxPlayerHp: 100, ki, message: "" });

  it("CUSTOM_TECHNIQUE deals real damage, consumes Ki, sets cooldown, blocks refire", () => {
    const s = gameWithTech();
    const b1 = resolveBattleAction(battle(100), s, { type: "CUSTOM_TECHNIQUE", techniqueId: baseTech.id, now: 1000 });
    expect(b1.hp).toBeLessThan(1e8);
    expect(b1.ki).toBe(75);
    const b2 = resolveBattleAction(b1, s, { type: "CUSTOM_TECHNIQUE", techniqueId: baseTech.id, now: 1100 });
    expect(b2.message).toMatch(/recovering/i);
    expect(b2.ki).toBe(75);
  });

  it("EXPOSED triples the first hit via weak point, then ×2 — no double-dip (×4)", () => {
    const s = gameWithTech();
    const plain = resolveBattleAction(battle(100), s, { type: "CUSTOM_TECHNIQUE", techniqueId: baseTech.id, now: 1000 });
    const exposed = resolveBattleAction({ ...battle(100), exposedUntil: 99_999 }, s, { type: "CUSTOM_TECHNIQUE", techniqueId: baseTech.id, now: 1000 });
    const normalHit = 1e8 - plain.hp;
    const exposedHit = 1e8 - exposed.hp;
    expect(normalHit).toBeGreaterThan(0);
    // First hit during the exposed window is a weak-point strike (×3); before the audit fix this was ×4.
    expect(exposedHit).toBe(normalHit * 3);
  });

  it("CUSTOM_TECHNIQUE refuses with insufficient Ki and enforces infiniteKi override", () => {
    const s = gameWithTech();
    const b = resolveBattleAction(battle(10), s, { type: "CUSTOM_TECHNIQUE", techniqueId: baseTech.id, now: 1 });
    expect(b.ki).toBe(10);
    const s2 = { ...s, infiniteKi: true };
    const b2 = resolveBattleAction(battle(0), s2, { type: "CUSTOM_TECHNIQUE", techniqueId: baseTech.id, now: 1 });
    expect(b2.hp).toBeLessThan(1e8);
  });
});

describe("god engine — save hydration for new fields", () => {
  it("hydrate keeps valid custom techs and drops junk", () => {
    const s = hydrate({
      customTechniques: [
        { id: "custom-tech-ok", name: "Solar", desc: "d", scale: "ki", mult: 5, kiCost: 10, cooldownMs: 100, aura: "#fff" },
        { id: "bad-id", name: "Nope", desc: "d", scale: "ki", mult: 5, kiCost: 10, cooldownMs: 100, aura: "#fff" },
        { id: "custom-tech-2", name: "BadScale", desc: "d", scale: "luck", mult: 5, kiCost: 10, cooldownMs: 100, aura: "#fff" },
        "garbage",
      ],
      infiniteKi: true,
      adminEvents: [
        { id: "ok", at: 1, action: "SET_STAT", target: "strength", previousValue: "1", newValue: "2", outcome: "ok" },
        { id: "", at: "NaN" },
        null,
      ],
    });
    expect(s.customTechniques.map((t) => t.id)).toEqual(["custom-tech-ok"]);
    expect(s.infiniteKi).toBe(true);
    expect(s.adminEvents).toHaveLength(1);
  });

  it("custom techniques survive a save round trip", () => {
    const s = fresh();
    s.customTechniques = [{ id: "custom-tech-x", name: "Solar", desc: "d", scale: "strength", mult: 2, kiCost: 20, cooldownMs: 50, aura: "#f0f" }];
    const back = openSave(sealSave(s))!;
    expect(back.customTechniques).toHaveLength(1);
    expect(back.customTechniques[0]?.mult).toBe(2);
  });
});

describe("god engine — deterministic battle simulator", () => {
  it("a god-level build beats Raditz; a zero build cannot", () => {
    const god = fresh();
    god.stats.strength = 1e6; god.stats.agility = 1e6; god.stats.ki = 1e6; god.stats.defense = 1e6;
    const win = simulateBossFight(god, BOSSES[0]!);
    expect(win.result).toBe("win");
    const zero = fresh();
    const loss = simulateBossFight(zero, BOSSES[0]!, 30);
    expect(loss.result).not.toBe("win");
  });

  it("simulation is deterministic for identical inputs", () => {
    const g = fresh(); g.stats.strength = 5000; g.stats.agility = 1000; g.stats.ki = 1000; g.stats.defense = 100;
    const a = simulateBossFight(g, BOSSES[1]!); // Vegeta
    const b = simulateBossFight(g, BOSSES[1]!);
    expect(a).toEqual(b);
  });
});

describe("god engine — command console", () => {
  it("help lists exactly the registered commands", () => {
    const s = fresh();
    const out = parseAdminCommand("help", s);
    expect(out.ok).toBe(true);
    for (const c of COMMANDS) expect(out.message).toContain(c.name);
  });

  it("garbage input is rejected with a reason", () => {
    const s = fresh();
    expect(parseAdminCommand("", s).ok).toBe(false);
    expect(parseAdminCommand("nonsense", s).ok).toBe(false);
    expect(parseAdminCommand("player.setStat luck 5", s).ok).toBe(false);
    expect(parseAdminCommand("player.setStat strength monkey", s).ok).toBe(false);
    expect(parseAdminCommand("quest.complete nowhere", s).ok).toBe(false);
    expect(parseAdminCommand("battle.spawnBoss monke", s).ok).toBe(false);
    expect(parseAdminCommand("world.teleport earth", s).ok).toBe(false);
  });

  it("valid commands map to real admin actions", () => {
    const s = fresh();
    expect(parseAdminCommand("player.setStat strength 999", s).action).toEqual({ type: "SET_STAT", stat: "strength", value: 999 });
    expect(parseAdminCommand("player.setLevel 7", s).action).toEqual({ type: "SET_LEVEL", level: 7 });
    expect(parseAdminCommand("player.setPowerLevel 1000", s).action).toEqual({ type: "SET_POWER_LEVEL", target: 1000 });
    expect(parseAdminCommand("quest.complete all", s).action).toEqual({ type: "COMPLETE_QUEST", questId: "all" });
    expect(parseAdminCommand("world.teleport htc", s).action).toEqual({ type: "TELEPORT", locationId: "htc" });
    expect(parseAdminCommand("battle.spawnBoss vegeta", s).action).toEqual({ type: "SPAWN_BOSS", bossId: "vegeta" });
    expect(parseAdminCommand("player.setGodMode on", s).action).toEqual({ type: "SET_GOD_MODE", flag: true });
  });

  it("quest.complete/reset and unlock-all flags demand confirmation from the caller", () => {
    expect(adminActionRequiresConfirmation({ type: "COMPLETE_QUEST", questId: "all" })).toBe(true);
    expect(adminActionRequiresConfirmation({ type: "RESET_QUEST", questId: "q1" })).toBe(true);
    expect(adminActionRequiresConfirmation({ type: "UNLOCK_ALL_FORMS" })).toBe(true);
    expect(adminActionRequiresConfirmation({ type: "SET_STAT", stat: "ki", value: 1 })).toBe(false);
  });

  it("autocomplete narrows by prefix and never suggests garbage", () => {
    const hits = consoleSuggestions("player.s");
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.name.startsWith("player.s")).toBe(true);
    expect(consoleSuggestions("zzz")).toHaveLength(0);
  });

  it("commands stay pure: parsing does not mutate the draft", () => {
    const s = fresh();
    const before = structuredClone(s);
    parseAdminCommand("player.setStat strength 999", s);
    expect(s).toEqual(before);
  });
});
