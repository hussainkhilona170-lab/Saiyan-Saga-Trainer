import { describe, it, expect } from "vitest";
import { applyAction, applyShadowRewards, battleClashDelay, canUnlockForm, effectiveTrainingGain, hydrate, initialState, levelForXp, openSave, powerLevel, rankForLevel, sealSave, shadowDummyBoss, SHADOW_REWARD_MULT, SHADOW_ZENKAI_MULT, xpRequiredForLevel } from "@/game/engine";

const fresh = () => structuredClone(initialState);

describe("engine", () => {
  it("power level of a new character is 40", () => expect(powerLevel(fresh())).toBe(40));
  it("training costs 1 stamina and adds gain", () => {
    const d = fresh(); applyAction(d, { type: "TRAIN_STAT", stat: "strength", rand: 1 });
    expect(d.stamina).toBe(99); expect(d.stats.strength).toBeGreaterThan(1); expect(d.stats.strength).toBeLessThan(2);
  });
  it("no training with empty stamina", () => {
    const d = fresh(); d.stamina = 0; applyAction(d, { type: "TRAIN_STAT", stat: "ki", rand: 1 });
    expect(d.stats.ki).toBe(1);
  });
  it("gravity levels up after gravity×25 progress", () => {
    const d = fresh(); for (let i = 0; i < 25; i++) applyAction(d, { type: "TRAIN_GRAVITY" });
    expect(d.gravity).toBe(2);
  });
  it("hydrate keeps old save progress and repairs bad fields", () => {
    const s = hydrate({ zeni: 500, stats: { strength: 99, agility: "x" }, forms: null });
    expect(s.zeni).toBe(500); expect(s.stats.strength).toBe(99); expect(s.stats.agility).toBe(1);
    expect(s.forms).toEqual(["base"]);
  });
  it("soft-caps repeated stat growth while mastery improves its yield", () => {
    const s = fresh();
    const early = effectiveTrainingGain(s, "strength");
    s.stats.strength = 1000;
    const capped = effectiveTrainingGain(s, "strength");
    s.mastery.strength = 100;
    const mastered = effectiveTrainingGain(s, "strength");
    expect(capped).toBeLessThan(early);
    expect(mastered).toBeGreaterThan(capped);
  });
  it("level thresholds produce the expected fighter rank", () => {
    expect(levelForXp(xpRequiredForLevel(5))).toBe(5);
    expect(rankForLevel(5)).toBe("Fighter");
  });
  it("simulates 500 deterministic training reps into level 5", () => {
    const s = fresh(); s.godMode = true;
    for (let i = 0; i < 500; i++) applyAction(s, { type: "TRAIN_STAT", stat: "strength", rand: 1 });
    expect(s.level).toBe(5);
    expect(s.stats.strength).toBeGreaterThan(1);
    expect(s.mastery.strength).toBeGreaterThan(0);
  });
  it("requires the level, power, and Zeni gates before unlocking Kaioken", () => {
    const s = fresh(); s.stats.strength = 1000; s.zeni = 1500;
    expect(canUnlockForm(s, "kaioken")).toBe(false);
    s.level = 2;
    expect(canUnlockForm(s, "kaioken")).toBe(true);
    applyAction(s, { type: "UNLOCK_FORM", formId: "kaioken" });
    expect(s.zeni).toBe(0);
    expect(s.forms).toContain("kaioken");
  });
  it("repairs older saves with no level or mastery fields", () => {
    const s = hydrate({ zeni: 100 });
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.mastery).toEqual({ strength: 0, agility: 0, ki: 0, defense: 0 });
  });
});

import { applyAction as act2, formMult as fm2, hydrate as hy2, initialState as init2, CUSTOM_FORM_MAX_MULT } from "@/game/engine";
describe("custom transformations", () => {
  it("creates an owned form, caps power, and applies its multiplier", () => {
    const s = structuredClone(init2);
    act2(s, { type: "CREATE_FORM", id: "custom-1", name: "Rosé", mult: 999999, aura: "#f0f", hair: "#f9f" });
    act2(s, { type: "TRANSFORM", formId: "custom-1" });
    expect(s.forms).toContain("custom-1");
    expect(fm2(s)).toBe(CUSTOM_FORM_MAX_MULT);
  });
  it("deleting the active custom form returns to base and survives reload", () => {
    const s = structuredClone(init2);
    act2(s, { type: "CREATE_FORM", id: "custom-2", name: "X", mult: 50, aura: "#fff", hair: "#fff" });
    expect(hy2(JSON.parse(JSON.stringify(s))).customForms[0]?.mult).toBe(50);
    act2(s, { type: "TRANSFORM", formId: "custom-2" });
    act2(s, { type: "DELETE_FORM", formId: "custom-2" });
    expect(s.activeForm).toBe("base");
  });
});

describe("god engine quest control", () => {
  it("force-claims a quest without meeting its requirements and grants full rewards", () => {
    const s = fresh();
    applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: "q9" });
    expect(s.quests).toContain("q9");
    expect(s.zeni).toBe(1e10);
    expect(s.tp).toBe(3000);
    expect(s.xp).toBeGreaterThan(0);
    expect(s.level).toBeGreaterThan(1);
  });
  it("never pays the same quest twice", () => {
    const s = fresh();
    applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: "q1" });
    applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: "q1" });
    expect(s.zeni).toBe(1000);
    expect(s.quests.filter((q) => q === "q1")).toHaveLength(1);
  });
  it("normal claims still require questDone before paying", () => {
    const s = fresh();
    applyAction(s, { type: "CLAIM_QUEST", questId: "q1" });
    expect(s.quests).not.toContain("q1");
    expect(s.zeni).toBe(0);
  });
});

describe("shadow dummy sparring", () => {
  it("scales the shadow dummy to 1.75× the player's stats, form multiplier included", () => {
    const s = fresh();
    for (const k of ["strength", "agility", "ki", "defense"] as const) s.stats[k] = 10;
    const boss = shadowDummyBoss(s);
    expect(boss.hp).toBe(700);
    expect(boss.atk).toBe(31);
    s.forms.push("kaioken");
    s.activeForm = "kaioken";
    expect(shadowDummyBoss(s).hp).toBeGreaterThan(700);
  });
  it("beating the shadow dummy multiplies all stats by 1.35", () => {
    const s = fresh();
    s.stats.strength = 100; s.stats.agility = 40;
    applyShadowRewards(s, false);
    expect(s.stats.strength).toBeCloseTo(100 * SHADOW_REWARD_MULT);
    expect(s.stats.agility).toBeCloseTo(40 * SHADOW_REWARD_MULT);
    expect(s.stamina).toBe(100);
  });
  it("surviving at low health triggers the Zenkai boost and refills stamina", () => {
    const s = fresh();
    s.stats.strength = 100; s.stamina = 12;
    applyShadowRewards(s, true);
    expect(s.stats.strength).toBeCloseTo(100 * SHADOW_ZENKAI_MULT);
    expect(s.stamina).toBe(s.maxStamina);
  });
  it("always opens a dark beam clash early against the shadow dummy", () => {
    expect(battleClashDelay(shadowDummyBoss(fresh()))).toBe(2400);
  });
  it("remembers the Dark Ki Aura cosmetic across reloads", () => {
    const s = fresh(); s.darkAura = true;
    expect(hydrate(JSON.parse(JSON.stringify(s))).darkAura).toBe(true);
    expect(hydrate({}).darkAura).toBe(false);
  });
});

describe("save integrity", () => {
  it("seals and reopens a save without losing progress", () => {
    const s = fresh();
    s.zeni = 12345; s.defeated.push("raditz");
    const out = openSave(sealSave(s));
    expect(out?.zeni).toBe(12345);
    expect(out?.defeated).toContain("raditz");
    expect(out?.darkAura).toBe(false);
  });
  it("rejects malformed save text so callers can fall back", () => {
    expect(openSave("not json")).toBeNull();
    expect(openSave("[1,2,3]")).toBeNull();
    expect(openSave("")).toBeNull();
  });
});
