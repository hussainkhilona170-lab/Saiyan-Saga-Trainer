import { describe, it, expect } from "vitest";
import { buildBossFromId, bossIdSuggestions } from "@/game/bossLibrary";
import { applyScenarioBuild, parseScenarioList, serializeScenarioList, createScenario } from "@/game/scenarios";
import { initialState, powerLevel } from "@/game/engine";

const fresh = () => structuredClone(initialState);

describe("bossLibrary — id resolution for scenarios and the battle tester", () => {
  it("resolves every roster boss", () => {
    for (const id of ["raditz", "vegeta", "frieza", "cell", "buu", "beerus"]) {
      const boss = buildBossFromId(id);
      expect(boss?.id).toBe(id);
      expect(boss?.hp).toBeGreaterThan(0);
    }
  });

  it("resolves raid bosses with their full reward profile", () => {
    const broly = buildBossFromId("raid-broly")!;
    expect(broly.name).toMatch(/Broly/);
    expect(broly.zeni).toBe(3e10);
    expect(broly.signature?.name).toMatch(/Eraser Cannon/);
  });

  it("resolves tournament rounds with scaled stats and entry gates", () => {
    const r1 = buildBossFromId("tournament-r1")!;
    expect(r1.name).toMatch(/Yamu/);
    expect(r1.tournament).toBe(0);
    expect(r1.hp).toBeLessThan(buildBossFromId("raditz")!.hp);
  });

  it("resolves endless waves with scaling and rejects garbage", () => {
    const w1 = buildBossFromId("endless-1")!;
    const w20 = buildBossFromId("endless-20")!;
    expect(w20.hp).toBeGreaterThan(w1.hp);
    expect(buildBossFromId("endless-")).toBeNull();
    expect(buildBossFromId("monke")).toBeNull();
    expect(buildBossFromId("endless-x")).toBeNull();
  });

  it("suggestions cover roster, raids, tournament and endless", () => {
    const s = bossIdSuggestions();
    expect(s).toContain("raditz");
    expect(s).toContain("raid-broly");
    expect(s).toContain("tournament-r4");
    expect(s).toContain("endless-1");
  });
});

describe("scenario creator — capture, persist, reapply", () => {
  it("capture → serialize → parse round-trips a build", () => {
    const s = fresh();
    s.stats.strength = 1234; s.level = 42; s.xp = 999_000; s.activeForm = "ssj4"; s.forms.push("ssj4"); s.gravity = 5;
    const sc = createScenario(s, "Godslayer setup", "beerus", "bring the pain", 1_000_000);
    expect(sc.name).toBe("Godslayer setup");
    expect(sc.build.stats.strength).toBe(1234);
    const back = parseScenarioList(serializeScenarioList([sc]));
    expect(back).toHaveLength(1);
    expect(back[0]?.bossId).toBe("beerus");
    expect(back[0]?.build.formId).toBe("ssj4");
    expect(back[0]?.build.gravity).toBe(5);
  });

  it("parseScenarioList drops garbage without crashing", () => {
    expect(parseScenarioList("not json")).toEqual([]);
    expect(parseScenarioList("{}")).toEqual([]);
    const s = fresh();
    const sc = createScenario(s, "legit", "raditz");
    const mangled = JSON.stringify([sc, { id: "x" }, null, 42, { id: "y", name: "bad", bossId: "raditz", build: null }]);
    const parsed = parseScenarioList(mangled);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("legit");
  });

  it("applyScenarioBuild restores stats, level, gravity, and activates the form", () => {
    const s = fresh();
    s.activeForm = "base";
    const build = { stats: { strength: 500, agility: 600, ki: 700, defense: 800 }, level: 50, xp: 5_000_000, mastery: { strength: 55, agility: 44, ki: 33, defense: 22 }, gravity: 4, formId: "ssj4", customForms: [] };
    const applied = applyScenarioBuild(s, build);
    expect(applied).toBe("ssj4");
    expect(s.forms).toContain("ssj4");
    expect(s.activeForm).toBe("ssj4");
    expect(s.stats.strength).toBe(500);
    expect(s.gravity).toBe(4);
    expect(s.level).toBeGreaterThanOrEqual(50);
  });

  it("scenarios survive a serialize/parse round trip of the persisted list", () => {
    const s = fresh();
    const sc = createScenario(s, "checkpoint", "vegeta", "", 123_456_789);
    const list = parseScenarioList(serializeScenarioList([sc]));
    expect(list).toHaveLength(1);
    expect(list[0]?.createdAt).toBe(123_456_789);
    expect(list[0]?.bossId).toBe("vegeta");
  });
});

describe("scenario apply — form gating consistency with engine", () => {
  it("scenario carries custom transformations into a foreign save (re-registers them)", () => {
    const owner = fresh();
    owner.customForms = [{ id: "custom-test-form", name: "Solar Crown", mult: 7, req: 0, cost: 0, aura: "#f0f", levelReq: 1, custom: true }];
    owner.forms = ["base", "custom-test-form"];
    owner.activeForm = "custom-test-form";
    const sc = createScenario(owner, "Custom form test", "raditz");
    const foreign = fresh();
    expect(foreign.customForms).toHaveLength(0);
    const applied = applyScenarioBuild(foreign, sc.build);
    expect(applied).toBe("custom-test-form");
    expect(foreign.forms).toContain("custom-test-form");
    expect(foreign.customForms).toHaveLength(1);
    expect(foreign.activeForm).toBe("custom-test-form");
  });

  it("powerLevel is applied to a scenario build for the tester preview math", () => {
    const s = fresh();
    s.stats.strength = 10; s.stats.agility = 10; s.stats.ki = 10; s.stats.defense = 10;
    expect(powerLevel(s)).toBe(400);
  });
});
