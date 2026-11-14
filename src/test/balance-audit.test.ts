import { describe, it, expect } from "vitest";
import { BOSSES } from "@/game/data";
import { simulateBossFight } from "@/game/battleSim";
import { initialState, type GameState } from "@/game/engine";

/** Balance audit probe — not a damage-band lock, just asserts sanity invariants. */
const build = (level: number, stat: number, formId: string, gravity = 1): GameState => {
  const s = structuredClone(initialState);
  s.level = level;
  s.stats.strength = stat; s.stats.agility = stat; s.stats.ki = stat; s.stats.defense = stat;
  s.xp = 0;
  s.gravity = gravity;
  s.forms = ["base", formId];
  s.activeForm = formId;
  return s;
};
const report = (label: string, buildState: GameState, bossIdx: number) => {
  const r = simulateBossFight(buildState, BOSSES[bossIdx]!, 240);
  console.info(`[balance] ${label} vs ${BOSSES[bossIdx]!.name.padEnd(14)} → ${r.result.padEnd(7)} ${r.seconds}s (boss ${Math.floor(r.bossHpLeft)} left)`);
  return r;
};

describe("balance audit probe (simulator sanity)", () => {
  it("a fresh player cannot beat Raditz — training is required first (documented, not a regression)", () => {
    const fresh = build(1, 1, "base");
    const r = report("fresh", fresh, 0);
    expect(r.result).toBe("lose");
  });

  it("a lightly-trained player beats Raditz comfortably", () => {
    const trainee = build(5, 500, "kaioken");
    const r = report("trainee", trainee, 0);
    expect(r.result).toBe("win");
  });

  it("stronger builds win progressively harder fights", () => {
    const mid = build(15, 2000, "ssj3", 3);
    const midFrieza = report("mid    ", mid, 2);
    expect(midFrieza.result).toBe("win");
    const late = build(24, 400000, "blue", 10);
    const lateBeerus = report("late   ", late, 5);
    expect(lateBeerus.result).toBe("win");
  });

  it("simulation determinism holds for identical builds", () => {
    const a = simulateBossFight(build(10, 1000, "ssj2"), BOSSES[2]!, 240);
    const b = simulateBossFight(build(10, 1000, "ssj2"), BOSSES[2]!, 240);
    expect(a).toEqual(b);
  });
});
