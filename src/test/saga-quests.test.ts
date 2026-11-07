import { describe, it, expect } from "vitest";
import { TOURNAMENT, QUESTS, SAGA_BONUSES } from "@/game/data";
import {
  applyAction, applyTournamentRewards, initialState, questDone, questSummary,
  sagaStatus, sealSave, openSave, hydrate,
} from "@/game/engine";

const fresh = () => structuredClone(initialState);

describe("quest v2 — counted objectives", () => {
  it("TRAIN_STAT feeds the 100-rep training quest", () => {
    const s = fresh(); s.godMode = true;
    for (let i = 0; i < 100; i++) applyAction(s, { type: "TRAIN_STAT", stat: "strength", rand: 1 });
    expect(questSummary(s, "q11")?.progress).toBe(100);
    expect(questDone(s, "q11")).toBe(true);
    const zeniBefore = s.zeni;
    applyAction(s, { type: "CLAIM_QUEST", questId: "q11" });
    expect(s.zeni).toBeGreaterThan(zeniBefore);
    expect(s.quests).toContain("q11");
  });

  it("SCOUT spends stamina, grants XP, and advances scout quests", () => {
    const s = fresh(); s.stamina = 10;
    applyAction(s, { type: "SCOUT", rand: 0.99 });
    expect(s.stamina).toBe(8);
    expect(questSummary(s, "q10")?.progress ?? 0).toBe(1);
    const poor = fresh(); applyAction(poor, { type: "SCOUT", rand: 0.99 }); // starts with 100 stamina
    expect(poor.stamina).toBe(98);
  });

  it("SCOUT fails cleanly without stamina", () => {
    const s = fresh(); s.stamina = 0;
    applyAction(s, { type: "SCOUT", rand: 0.5 });
    expect(questSummary(s, "q10")?.progress ?? 0).toBe(0);
  });

  it("dragon balls feed collect quests whether from caches or battles", () => {
    const s = fresh(); s.stamina = 100;
    let ballFound = false;
    for (let i = 0; i < 5 && !ballFound; i++) {
      s.stamina = 100;
      applyAction(s, { type: "SCOUT", rand: 0.01 }); // always the ball branch
      ballFound = s.dragonBalls > 0;
    }
    expect(ballFound).toBe(true);
    expect(questSummary(s, "q13")?.progress).toBeGreaterThanOrEqual(1);
  });

  it("wishes feed the wish quest (q15); claiming still obeys the prerequisite chain", () => {
    const s = fresh(); s.dragonBalls = 7;
    applyAction(s, { type: "MAKE_WISH", wishId: "tp" });
    expect(questSummary(s, "q15")?.progress).toBe(1);
    expect(questDone(s, "q15")).toBe(false); // q13 prereq not claimed yet
    s.quests.push("q13");
    expect(questDone(s, "q15")).toBe(true);
  });

  it("q15 stays locked until its prerequisite (q13) is claimed, even with a wish made", () => {
    const s = fresh(); s.dragonBalls = 7; s.questProgress["q15"] = 1;
    const q15 = QUESTS.find((q) => q.id === "q15")!;
    expect(q15.prereq).toContain("q13");
    expect(questDone(s, "q15")).toBe(false);
    applyAction(s, { type: "CLAIM_QUEST", questId: "q15" });
    expect(s.quests).not.toContain("q15");
  });
});

describe("quest v2 — prerequisites & claim integrity", () => {
  it("boss quest for Vegeta is locked before Raditz is claimed", () => {
    const s = fresh(); s.defeated.push("vegeta");
    expect(questDone(s, "q3")).toBe(false);
    s.quests.push("q1", "q2"); // simulate claims
    expect(questDone(s, "q3")).toBe(true);
  });

  it("normal claim pays rewards once and never twice", () => {
    const s = fresh(); s.defeated.push("raditz"); s.quests.push("q1");
    applyAction(s, { type: "CLAIM_QUEST", questId: "q2" });
    const { zeni, tp } = s;
    applyAction(s, { type: "CLAIM_QUEST", questId: "q2" });
    expect(s.zeni).toBe(zeni);
    expect(s.tp).toBe(tp);
  });

  it("force-claim bypasses locks for the God Engine but still pays only once", () => {
    const s = fresh();
    applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: "q9" });
    expect(s.quests).toContain("q9");
    const { zeni } = s;
    applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: "q9" });
    expect(s.zeni).toBe(zeni);
  });

  it("progress counters survive a save/load round trip", () => {
    const s = fresh(); s.questProgress["q11"] = 55; s.questProgress["q10"] = 3; s.questProgress["q1"] = 999; // q1 is not a counted quest — must be dropped
    const out = openSave(sealSave(s))!;
    expect(out.questProgress).toEqual({ q11: 55, q10: 3 });
  });

  it("hydrate rejects non-numeric quest progress without crashing", () => {
    const out = hydrate({ questProgress: { q11: "lots", q10: -4, q13: 2 } });
    expect(out.questProgress).toEqual({ q13: 2 });
  });
});

describe("saga completion bonuses", () => {
  const claimAllIn = (s: ReturnType<typeof fresh>, saga: string) => {
    for (const q of QUESTS.filter((q) => q.saga === saga)) applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: q.id });
  };

  it("a saga bonus pays exactly once after all its quests are claimed", () => {
    const s = fresh();
    const before = s.zeni;
    claimAllIn(s, "Saiyan Saga");
    const afterClaims = s.zeni;
    applyAction(s, { type: "CLAIM_SAGA", saga: "Saiyan Saga" });
    expect(s.sagaBonuses).toContain("Saiyan Saga");
    expect(s.zeni).toBe(afterClaims + SAGA_BONUSES["Saiyan Saga"]!.zeni);
    const paid = s.zeni;
    applyAction(s, { type: "CLAIM_SAGA", saga: "Saiyan Saga" });
    expect(s.zeni).toBe(paid); // second claim is a no-op
  });

  it("a saga is not claimable while any of its quests are unclaimed", () => {
    const s = fresh();
    applyAction(s, { type: "FORCE_CLAIM_QUEST", questId: "q1" });
    applyAction(s, { type: "CLAIM_SAGA", saga: "Saiyan Saga" });
    expect(s.sagaBonuses).not.toContain("Saiyan Saga");
    expect(sagaStatus(s, "Saiyan Saga").complete).toBe(false);
  });

  it("saga bonus claims persist through saves", () => {
    const s = fresh();
    claimAllIn(s, "Saiyan Saga");
    applyAction(s, { type: "CLAIM_SAGA", saga: "Saiyan Saga" });
    const out = openSave(sealSave(s))!;
    expect(out.sagaBonuses).toContain("Saiyan Saga");
  });
});

describe("World Martial Arts Tournament", () => {
  it("first clears pay in full and advance the bracket", () => {
    const s = fresh(); s.zeni = 0; s.tp = 0;
    applyTournamentRewards(s, 0);
    expect(s.tournamentRound).toBe(1);
    expect(s.zeni).toBe(TOURNAMENT[0]!.zeni);
    expect(s.tp).toBe(TOURNAMENT[0]!.tp);
    expect(questSummary(s, "q14")?.progress).toBe(1);
  });

  it("out-of-order wins do not advance the bracket (rematch pays 15%)", () => {
    const s = fresh(); s.zeni = 0;
    applyTournamentRewards(s, 1); // round 2 while round 1 is pending
    expect(s.tournamentRound).toBe(0);
    expect(s.zeni).toBe(Math.floor(TOURNAMENT[1]!.zeni * 0.15));
  });

  it("cleared rounds can be re-fought for 15% rematch rewards", () => {
    const s = fresh(); s.zeni = 0;
    applyTournamentRewards(s, 0);
    const afterFirst = s.zeni;
    applyTournamentRewards(s, 0);
    expect(s.zeni).toBe(afterFirst + Math.floor(TOURNAMENT[0]!.zeni * 0.15));
    expect(s.tournamentRound).toBe(1);
  });

  it("clearing all four rounds crowns the champion and caps the round counter", () => {
    const s = fresh();
    for (let i = 0; i < TOURNAMENT.length; i++) applyTournamentRewards(s, i);
    expect(s.tournamentRound).toBe(TOURNAMENT.length);
    applyTournamentRewards(s, 0); // extra rematch cannot overflow the counter
    expect(s.tournamentRound).toBe(TOURNAMENT.length);
  });

  it("tournament rounds persist and survive corruption", () => {
    const s = fresh(); s.tournamentRound = 3;
    const out = openSave(sealSave(s))!;
    expect(out.tournamentRound).toBe(3);
    const insane = hydrate({ tournamentRound: 9999 });
    expect(insane.tournamentRound).toBeLessThanOrEqual(TOURNAMENT.length);
  });
});
