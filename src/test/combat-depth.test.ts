import { describe, it, expect } from "vitest";
import { BOSSES, ENDLESS_ROSTER } from "@/game/data";
import { buildBossFromId } from "@/game/bossLibrary";
import {
  applyAction, battleClashDelay, battleClashPressure, battleGrade, battlePhaseOf, battleSagaRank, GRADE_ORDER, initialBattleState, initialState,
  phaseScale, resolveBattleAction, sealSave, openSave, hydrate, type BattleState,
} from "@/game/engine";

const game = () => {
  const g = structuredClone(initialState);
  g.stats.strength = 100; g.stats.agility = 100; g.stats.ki = 100; g.stats.defense = 100;
  return g;
};
const boss = (overrides: Partial<(typeof BOSSES)[number]> = {}) => ({ ...BOSSES[0]!, ...overrides }); // Raditz
const tank = () => boss({ id: "frieza", name: "Tankling", hp: 1e7, atk: 10 });
const bstate = (b = boss()): BattleState => ({
  ...structuredClone(initialBattleState),
  boss: b,
  phase: "active" as const,
  hp: b.hp,
  playerHp: 5000,
  maxPlayerHp: 5000,
  ki: 100,
  message: "",
});
const run = (battle: BattleState, g: ReturnType<typeof game>, action: Parameters<typeof resolveBattleAction>[2]) =>
  resolveBattleAction(battle, g, action);

describe("combat depth — boss phases", () => {
  it("phase scales: 1 at opener, 2 below 66%, 3 below 33%", () => {
    expect(battlePhaseOf(1000, 1000)).toBe(1);
    expect(battlePhaseOf(660, 1000)).toBe(2);
    expect(battlePhaseOf(331, 1000)).toBe(2);
    expect(battlePhaseOf(330, 1000)).toBe(3); // at-or-below 33% is critical
    expect(phaseScale(1)).toBe(1);
    expect(phaseScale(2)).toBe(1.35);
    expect(phaseScale(3)).toBe(1.7);
  });

  it("damaging the boss through 66% triggers the EXPOSED surge window", () => {
    const s = bstate(); s.hp = Math.floor(s.boss!.hp * 0.7); // just above the threshold
    const out = run(s, game(), { type: "PUNCH", now: 5000 });
    expect(out.phaseNumber).toBe(2);
    expect(out.exposedUntil).toBeGreaterThan(5000);
    expect(out.message).toMatch(/EXPOSED/i);
  });

  it("enraged boss hits meaningfully harder on enemy ticks", () => {
    const calm = bstate();
    const enraged = bstate();
    enraged.phaseNumber = 2;
    const g = game();
    const a = run(calm, g, { type: "ENEMY_TICK", playerMaxHp: 5000, now: 1000 });
    const b = run(enraged, g, { type: "ENEMY_TICK", playerMaxHp: 5000, now: 1000 });
    const dmgCalm = 5000 - a.playerHp;
    const dmgEnraged = 5000 - b.playerHp;
    expect(dmgEnraged).toBeGreaterThan(dmgCalm);
  });

  it("every boss has a signature move and uses it from phase 2 onward", () => {
    for (const b of BOSSES) expect(b.signature, `signature missing on ${b.id}`).toBeDefined();
    const s = bstate(); s.phaseNumber = 2; s.bossSpecialAt = 1000; // due now
    const out = run(s, game(), { type: "ENEMY_TICK", playerMaxHp: 5000, now: 1000 });
    expect(out.message).toMatch(/Double Sunday/);
    expect(out.bossSpecialAt).toBe(7000); // 6s cooldown applied
  });

  it("signature moves do not fire in phase 1", () => {
    const s = bstate(); s.bossSpecialAt = 1000; // due, but phase 1
    const out = run(s, game(), { type: "ENEMY_TICK", playerMaxHp: 5000, now: 1000 });
    expect(out.message).not.toMatch(/Double Sunday/);
  });
});

describe("combat depth — perfect guard / parry", () => {
  it("a parry inside the window nullifies damage and exposes the boss", () => {
    const s = bstate();
    const guarded = run(s, game(), { type: "PERFECT_GUARD", now: 1000 });
    expect(guarded.guardUntil).toBe(1450);
    const out = run(guarded, game(), { type: "ENEMY_TICK", playerMaxHp: 5000, now: 1100 });
    expect(out.playerHp).toBe(5000);
    expect(out.exposedUntil).toBeGreaterThanOrEqual(1100 + 2500);
    expect(out.message).toMatch(/PARRY/i);
  });

  it("a parry outside the window does nothing", () => {
    const s = bstate();
    const guarded = run(s, game(), { type: "PERFECT_GUARD", now: 1000 });
    const out = run(guarded, game(), { type: "ENEMY_TICK", playerMaxHp: 5000, now: 2000 }); // 550ms late
    expect(out.playerHp).toBeLessThan(5000);
  });

  it("Ultra Instinct form widens the parry window", () => {
    const s = bstate();
    const out = run(s, game(), { type: "PERFECT_GUARD", now: 1000, uiForm: true });
    expect(out.guardUntil).toBe(1750); // 750ms window instead of 450ms
    expect(out.guardCdUntil).toBe(1800);
  });

  it("guard cooldown blocks spam", () => {
    const s = bstate();
    const first = run(s, game(), { type: "PERFECT_GUARD", now: 1000 });
    const second = run(first, game(), { type: "PERFECT_GUARD", now: 1200 });
    expect(second.guardCdUntil).toBe(first.guardCdUntil); // unchanged — denied
    expect(second.message).toMatch(/recovering/i);
  });

  it("exposed boss takes double damage from attacks", () => {
    const s = bstate(tank()); s.exposedUntil = 99999;
    const out = run(s, game(), { type: "PUNCH", now: 1000 });
    const baseline = run(bstate(tank()), game(), { type: "PUNCH", now: 1000 });
    expect(out.hp).toBeLessThan(baseline.hp); // double damage → less HP remaining
  });
});

describe("combat depth — combo branches", () => {
  it("HEAVY is a finisher when combo is 4+", () => {
    const s = bstate(); s.combo = 5; s.lastPunchAt = 1000;
    const out = run(s, game(), { type: "HEAVY", now: 1500 });
    expect(out.message).toMatch(/Haymaker/i);
  });

  it("BLAST mid-combo gets the ki-assist bonus", () => {
    const s = bstate(); s.combo = 4;
    const out = run(s, game(), { type: "BLAST", now: 1000 });
    expect(out.message).toMatch(/Ki-assisted/i);
  });

  it("repeated Ki blasts are anticipated and blunted", () => {
    const s = bstate();
    s.kiStreak = 3; // three blasts already landed this fight
    const out = run(s, game(), { type: "BLAST", now: 1000 });
    expect(out.message).toMatch(/anticipates/i);
  });

  it("vanishing with a 4+ combo triggers the punish branch", () => {
    const s = bstate(); s.combo = 4;
    const out = run(s, game(), { type: "VANISH", now: 1000 });
    expect(out.message).toMatch(/punish/i);
  });

  it("ULTIMATE at 5+ combo triggers Final Stretch and its vulnerability window", () => {
    const s = bstate(tank()); s.combo = 5; s.ki = 100;
    const out = run(s, game(), { type: "ULTIMATE", now: 2000 });
    expect(out.message).toMatch(/FINAL STRETCH/i);
    expect(out.overloadedUntil).toBe(5000);
  });

  it("predictable melee opens the boss to a counter window", () => {
    const g = game();
    let s = bstate(tank());
    for (let i = 0; i < 4; i++) s = run(s, g, { type: "PUNCH", now: 1000 + i * 100 });
    expect(s.adaptMeleeUntil).toBeGreaterThan(1000);
    const out = run(s, g, { type: "ENEMY_TICK", playerMaxHp: 5000, now: s.adaptMeleeUntil });
    expect(out.message).toMatch(/counter/i);
  });
});

describe("combat depth — grades & persistence", () => {
  it("grades map from remaining HP fraction", () => {
    expect(battleGrade(0.9)).toBe("S");
    expect(battleGrade(0.7)).toBe("A");
    expect(battleGrade(0.5)).toBe("B");
    expect(battleGrade(0.2)).toBe("C");
    expect(battleGrade(0.05)).toBe("D");
    expect(GRADE_ORDER.indexOf("S")).toBeGreaterThan(GRADE_ORDER.indexOf("D"));
  });

  it("RECORD_BOSS_GRADE keeps the best letter grade only", () => {
    const s = structuredClone(initialState);
    applyAction(s, { type: "RECORD_BOSS_GRADE", bossId: "raditz", grade: "B" });
    applyAction(s, { type: "RECORD_BOSS_GRADE", bossId: "raditz", grade: "D" });
    expect(s.bestGrades["raditz"]).toBe("B");
    applyAction(s, { type: "RECORD_BOSS_GRADE", bossId: "raditz", grade: "S" });
    expect(s.bestGrades["raditz"]).toBe("S");
  });

  it("bestGrades survive save/load and garbage ranks are dropped", () => {
    const s = structuredClone(initialState);
    s.bestGrades["raditz"] = "A";
    const out = openSave(sealSave(s))!;
    expect(out.bestGrades["raditz"]).toBe("A");
    const bad = hydrate({ bestGrades: { x: "Z", y: 42, raditz: "C" } });
    expect(bad.bestGrades).toEqual({ raditz: "C" });
  });
});

describe("combat depth — integration sanity", () => {
  it("a full punch combo kills Raditz and reports a win without phase-surge message overwriting the victory", () => {
    const g = game();
    let s = bstate(); // player stats 100 → punch ~ (200+100)*1*bonus
    s.playerHp = 5000;
    let guard = 0;
    while (s.phase !== "won" && guard++ < 200) s = resolveBattleAction(s, g, { type: "PUNCH", now: guard * 100 });
    expect(s.phase).toBe("won");
    expect(s.message).toMatch(/defeated/i);
  });

  it("player death ends the fight and blocks further combat actions", () => {
    const g = game(); g.stats.defense = 0;
    const s = bstate(); s.phaseNumber = 3; s.playerHp = 1;
    const out = resolveBattleAction(s, g, { type: "ENEMY_TICK", playerMaxHp: 5000, now: 1000 });
    expect(out.phase).toBe("lost");
    const punched = resolveBattleAction(out, g, { type: "PUNCH", now: 2000 });
    expect(punched.phase).toBe("lost");
  });

  it("variant boss ids resolve their template's saga rank (drives clash pressure/delay)", () => {
    const rankOf = (id: string) => BOSSES.findIndex((b) => b.id === id);
    // Sanity for the assertions below: beerus is not the roster's rank-0 boss.
    expect(rankOf("beerus")).toBeGreaterThan(0);
    // Tournament variants inherit the roster template's rank…
    expect(battleSagaRank(buildBossFromId("tournament-r1")!)).toBe(rankOf("raditz"));
    expect(battleSagaRank(buildBossFromId("tournament-r4")!)).toBe(rankOf("beerus"));
    // …endless waves map through the rotating roster (wave 7 wraps back to wave 1)…
    expect(battleSagaRank(buildBossFromId("endless-1")!)).toBe(rankOf("raditz"));
    expect(battleSagaRank(buildBossFromId("endless-2")!)).toBe(rankOf("vegeta"));
    expect(battleSagaRank(buildBossFromId("endless-7")!)).toBe(rankOf(ENDLESS_ROSTER[0]!));
    // …and raids sit at end-of-roster clash pressure.
    const raid = buildBossFromId("raid-broly")!;
    expect(battleSagaRank(raid)).toBe(BOSSES.length - 1);
    expect(battleClashPressure(raid)).toBe(9 + (BOSSES.length - 1) * 10);
    expect(battleClashDelay(buildBossFromId("tournament-r4")!)).toBe(Math.max(6500, 11500 - rankOf("beerus") * 850));
  });
});
