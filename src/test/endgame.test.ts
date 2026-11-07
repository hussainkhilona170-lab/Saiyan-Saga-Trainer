import { describe, it, expect } from "vitest";
import { EQUIPMENT, CONSUMABLES, TECHNIQUE_RANKS } from "@/game/data";
import {
  applyAction, applyRaidRewards, applySurvivalRewards, applyTournamentRewards, bumpTechniqueUse, consumeItem,
  countItem, endlessBoss, equipmentBonus, hydrate, initialState, openSave, powerLevel, sealSave,
  techniqueRank, trainingGain, initialBattleState, resolveBattleAction, type BattleState,
} from "@/game/engine";

const fresh = () => structuredClone(initialState);

describe("equipment — buy, equip, bag integrity", () => {
  it("BUY_ITEM debits Zeni once and hands gear into the bag", () => {
    const s = fresh(); s.zeni = 100000;
    applyAction(s, { type: "BUY_ITEM", itemId: "turtle-shell" });
    expect(s.inventory["turtle-shell"]).toBe(1);
    expect(s.zeni).toBe(50000);
    expect(s.transactions.at(-1)?.label).toMatch(/Turtle Shell/);
    applyAction(s, { type: "BUY_ITEM", itemId: "turtle-shell" }); // unique — no double charge
    expect(s.zeni).toBe(50000);
    expect(s.inventory["turtle-shell"]).toBe(1);
  });

  it("BUY_ITEM refuses when Zeni is insufficient", () => {
    const s = fresh(); s.zeni = 100;
    applyAction(s, { type: "BUY_ITEM", itemId: "turtle-shell" });
    expect(countItem(s, "turtle-shell")).toBe(0);
  });

  it("EQUIP takes item from the bag to the body; UNEQUIP returns it", () => {
    const s = fresh(); s.zeni = 100000;
    applyAction(s, { type: "BUY_ITEM", itemId: "turtle-shell" });
    applyAction(s, { type: "EQUIP_ITEM", itemId: "turtle-shell" });
    expect(s.equipped).toContain("turtle-shell");
    expect(countItem(s, "turtle-shell")).toBe(0);
    applyAction(s, { type: "UNEQUIP_ITEM", itemId: "turtle-shell" });
    expect(s.equipped).not.toContain("turtle-shell");
    expect(countItem(s, "turtle-shell")).toBe(1);
  });

  it("one item per slot — equipping a second body piece swaps them", () => {
    const s = fresh();
    s.inventory = { "turtle-shell": 1, "potara": 1, "dragon-radar": 1 };
    applyAction(s, { type: "EQUIP_ITEM", itemId: "turtle-shell" });
    applyAction(s, { type: "EQUIP_ITEM", itemId: "dragon-radar" }); // accessory slot — both stay
    expect(s.equipped).toEqual(["turtle-shell", "dragon-radar"]);
    s.inventory["turtle-shell"] = 1; // owned already though... it's unique; but potara is also accessory
    applyAction(s, { type: "EQUIP_ITEM", itemId: "potara" }); // replaces the radar (accessory slot)
    expect(s.equipped).toContain("potara");
    expect(s.equipped).not.toContain("dragon-radar");
    expect(countItem(s, "dragon-radar")).toBe(1); // radar returned to bag
    expect(s.equipped).toContain("turtle-shell"); // body slot untouched
  });

  it("equipment bonuses flow into power level and training", () => {
    const s = fresh();
    s.stats.strength = 10; s.stats.agility = 10; s.stats.ki = 10; s.stats.defense = 10;
    const bare = powerLevel(s);
    s.equipped = ["turtle-shell"];
    const tanky = powerLevel(s);
    expect(tanky).toBeGreaterThan(bare); // defense counts ×1.25
    expect(Math.floor((10 + 10 + 10 + 12.5) * 10)).toBe(tanky);
    s.equipped = ["potara"];
    const po = powerLevel(s);
    expect(po).toBe(Math.floor(40 * 1.1 * 10));
    // weighted gloves boost training gain by 20%
    const before = trainingGain(s);
    s.equipped = ["weighted-gloves"];
    expect(trainingGain(s)).toBeCloseTo(before * 1.2, 6);
    // radar adds 5 points of scout find rate
    s.equipped = ["dragon-radar"];
    expect(equipmentBonus(s).scoutBallBonus).toBeCloseTo(0.05, 10);
  });
});

describe("consumables — buy, hold, battle use", () => {
  it("BUY_ITEM stacks consumables without the uniqueness rule", () => {
    const s = fresh(); s.zeni = 10000;
    applyAction(s, { type: "BUY_ITEM", itemId: "senzu" });
    applyAction(s, { type: "BUY_ITEM", itemId: "senzu" });
    expect(countItem(s, "senzu")).toBe(2);
    expect(s.zeni).toBe(0);
    expect(CONSUMABLES.map((c) => c.id)).toContain("senzu");
  });

  it("consumeItem drains the count and deletes empty entries", () => {
    const s = fresh(); s.inventory = { senzu: 2 };
    expect(consumeItem(s, "senzu")).toBe(true);
    expect(s.inventory["senzu"]).toBe(1);
    expect(consumeItem(s, "senzu")).toBe(true);
    expect("senzu" in s.inventory).toBe(false);
    expect(consumeItem(s, "senzu")).toBe(false);
  });

  it("USE_CONSUMABLE restores HP/Ki inside an active battle", () => {
    const g = fresh();
    const battle: BattleState = { ...structuredClone(initialBattleState), boss: { id: "raditz", name: "Raditz", hp: 1500, atk: 10, zeni: 1, tp: 1, req: 0, emoji: "x" }, phase: "active", hp: 1500, playerHp: 100, maxPlayerHp: 5000, ki: 5, message: "" };
    const healed = resolveBattleAction(battle, g, { type: "USE_CONSUMABLE", consumable: "senzu" });
    expect(healed.playerHp).toBe(5000);
    const kiFull = resolveBattleAction(healed, g, { type: "USE_CONSUMABLE", consumable: "tonic" });
    expect(kiFull.ki).toBe(100);
    const dead: BattleState = { ...battle, phase: "lost" };
    expect(resolveBattleAction(dead, g, { type: "USE_CONSUMABLE", consumable: "senzu" }).playerHp).toBe(100);
  });
});

describe("technique mastery — counters, ranks, effects", () => {
  it("rank thresholds match the registry", () => {
    const s = fresh();
    expect(techniqueRank(s, "punch")).toBe(0);
    for (let i = 0; i < TECHNIQUE_RANKS.length; i++) {
      s.techniqueUses["punch"] = TECHNIQUE_RANKS[i]!;
      expect(techniqueRank(s, "punch")).toBe(i + 1);
    }
  });

  it("bumpTechniqueUse increments and clamps", () => {
    const s = fresh();
    bumpTechniqueUse(s, "blast", 40);
    expect(s.techniqueUses["blast"]).toBe(40);
    s.techniqueUses["blast"] = 1_000_000;
    bumpTechniqueUse(s, "blast", 10);
    expect(s.techniqueUses["blast"]).toBe(1_000_000);
  });

  it("blast mastery rank 2 lowers the Ki cost from 20 to 15", () => {
    const g = fresh();
    g.stats.ki = 100; g.techniqueUses = { blast: TECHNIQUE_RANKS[1]! };
    const battle: BattleState = { ...structuredClone(initialBattleState), boss: { id: "raditz", name: "Raditz", hp: 1e6, atk: 1, zeni: 1, tp: 1, req: 0, emoji: "x" }, phase: "active", hp: 1e6, playerHp: 500, maxPlayerHp: 500, ki: 18, message: "" };
    const out = resolveBattleAction(battle, g, { type: "BLAST", now: 1 });
    expect(out.ki).toBe(3); // spent 15, not 20 (would be refused pre-mastery)
  });

  it("ultimate mastery rank 3 shortens the Ki Overload window", () => {
    const g = fresh();
    g.stats.ki = 500; g.techniqueUses = { ultimate: TECHNIQUE_RANKS[2]! };
    const battle: BattleState = { ...structuredClone(initialBattleState), boss: { id: "never-kill", name: "Dummy", hp: 1e7, atk: 1, zeni: 1, tp: 1, req: 0, emoji: "x" }, phase: "active", hp: 1e7, playerHp: 500, maxPlayerHp: 500, ki: 100, message: "" };
    const out = resolveBattleAction(battle, g, { type: "ULTIMATE", now: 10_000 });
    expect(out.overloadedUntil).toBe(11_500); // 1500ms instead of 3000ms
  });

  it("charge mastery rank 2 raises Ki gains by 25%", () => {
    const g = fresh(); g.techniqueUses = { charge: TECHNIQUE_RANKS[1]! };
    const battle: BattleState = { ...structuredClone(initialBattleState), boss: { id: "x", name: "Dummy", hp: 1e6, atk: 1, zeni: 1, tp: 1, req: 0, emoji: "x" }, phase: "active", hp: 1e6, playerHp: 500, maxPlayerHp: 500, ki: 0, message: "" };
    const out = resolveBattleAction(battle, g, { type: "CHARGE", amount: 4 });
    expect(out.ki).toBeCloseTo(5, 6);
  });

  it("parry mastery rank 3 widens the guard window to 550ms", () => {
    const g = fresh(); g.techniqueUses = { parry: TECHNIQUE_RANKS[2]! };
    const battle: BattleState = { ...structuredClone(initialBattleState), boss: { id: "x", name: "Dummy", hp: 1e6, atk: 1, zeni: 1, tp: 1, req: 0, emoji: "x" }, phase: "active", hp: 1e6, playerHp: 500, maxPlayerHp: 500, ki: 50, message: "" };
    const out = resolveBattleAction(battle, g, { type: "PERFECT_GUARD", now: 1000 });
    expect(out.guardUntil).toBe(1550);
  });
});

describe("endless survival — factory, rewards, best tracking", () => {
  it("waves scale and rotate through the roster", () => {
    const w1 = endlessBoss(1, "none");
    const w2 = endlessBoss(2, "none");
    expect(w2.hp).toBeGreaterThan(w1.hp);
    expect(w1.id).toBe("endless-1");
    expect(w1.name).toMatch(/Endless 1/);
  });

  it("aggression multiplies ATK and doubles rewards", () => {
    const a = endlessBoss(3, "aggression");
    const n = endlessBoss(3, "none");
    expect(a.atk).toBeGreaterThanOrEqual(Math.floor(n.atk * 1.45)); // ≈1.5× ATK after independent flooring
    expect(a.zeni).toBe(n.zeni * 2);
    expect(a.tp).toBe(3); // max(1, floor(3/2 × 2)) — reward multiplier applies pre-floor
  });

  it("heavyweight multiplies HP and doubles rewards", () => {
    const h = endlessBoss(3, "heavyweight");
    const n = endlessBoss(3, "none");
    expect(h.hp).toBeGreaterThanOrEqual(Math.floor(n.hp * 1.45));
    expect(h.zeni).toBe(n.zeni * 2);
  });

  it("applySurvivalRewards pays and records the best wave", () => {
    const s = fresh(); s.survivalBest = 2;
    applySurvivalRewards(s, endlessBoss(3, "none"));
    expect(s.survivalBest).toBe(3);
    expect(s.transactions.some((t) => t.label.includes("Endless Survival"))).toBe(true);
    applySurvivalRewards(s, endlessBoss(1, "none"));
    expect(s.survivalBest).toBe(3); // lower wave does not lower the record
  });
});

describe("raid bosses — first clear and rematch payouts", () => {
  it("first clear pays in full, marks defeated, and grants a Dragon Ball", () => {
    const s = fresh(); s.dragonBalls = 0; s.zeni = 0; s.tp = 0;
    applyRaidRewards(s, "broly");
    expect(s.zeni).toBe(3e10);
    expect(s.tp).toBe(600);
    expect(s.defeated).toContain("raid-broly");
    expect(s.dragonBalls).toBe(1);
  });

  it("rematches pay 15% and no additional Dragon Ball", () => {
    const s = fresh(); s.dragonBalls = 0;
    applyRaidRewards(s, "broly");
    const before = s.zeni;
    applyRaidRewards(s, "broly");
    expect(s.zeni).toBe(before + Math.floor(3e10 * 0.15));
    expect(s.dragonBalls).toBe(1);
  });
});

describe("save integrity — new fields persist", () => {
  it("inventory/equipped/techniqueUses/survivalBest survive a round trip", () => {
    const s = fresh();
    s.zeni = 100000; s.inventory = { "turtle-shell": 1, senzu: 3 }; s.equipped = ["turtle-shell"]; s.techniqueUses = { punch: 123 }; s.survivalBest = 7;
    const out = openSave(sealSave(s))!;
    expect(out.inventory).toEqual({ "turtle-shell": 1, senzu: 3 });
    expect(out.equipped).toEqual(["turtle-shell"]);
    expect(out.techniqueUses).toEqual({ punch: 123 });
    expect(out.survivalBest).toBe(7);
  });

  it("hydrate drops junk: unknown ids, absurd counts, slot conflicts", () => {
    const out = hydrate({
      inventory: { "not-a-real-item": 5, senzu: 99999, "turtle-shell": 400 },
      equipped: ["turtle-shell", "turtle-shell", "potara", "dragon-radar"], // turtle-shell dup, radar accessory slot conflict? potara is accessory too
      techniqueUses: { punch: 42, spell: 999, ultimate: -1 },
      survivalBest: 99999,
    });
    expect(out.inventory["not-a-real-item"]).toBeUndefined();
    expect(out.inventory["senzu"]).toBe(999);
    expect(out.inventory["turtle-shell"]).toBe(1);
    expect(out.techniqueUses).toEqual({ punch: 42 });
    expect(out.survivalBest).toBe(9999);
    expect(out.equipped.filter((id) => id === "turtle-shell")).toHaveLength(1);
    // one accessory slot: radar and potara both want it — first one wins, the other is dropped
    const accessories = out.equipped.filter((id) => id === "potara" || id === "dragon-radar");
    expect(accessories.length).toBe(1);
  });

  it("tournament rewards still pay correctly after survival rewards exist (no interference)", () => {
    const s = fresh(); s.zeni = 0;
    applyTournamentRewards(s, 0);
    expect(s.zeni).toBeGreaterThan(0);
  });
});
