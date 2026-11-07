import { describe, it, expect } from "vitest";
import {
  applyAction, applyBattleRewards, clampSaveNumber, initialState, MAX_SAVE_NUMBER, MAX_TRANSACTIONS,
  openSave, powerLevel, sealSave, SAVE_VERSION, hydrate,
} from "@/game/engine";
import { resolveInitialLoad, exportSlotText, slotKey, backupKey, MAIN_KEY, SANDBOX_KEY, BACKUP_SUFFIX } from "@/game/persistence";
import { createSnapshot, serializeSnapshot, parseSnapshot, parseSnapshotList, SNAPSHOT_VERSION } from "@/game/snapshots";

const fresh = () => structuredClone(initialState);

describe("save integrity — versioned envelope", () => {
  it("stays on save version 2 until a migration is authored", () => expect(SAVE_VERSION).toBe(2));
  it("exports the versioned envelope and re-imports it losslessly", () => {
    const s = fresh(); s.zeni = 98765; s.defeated.push("raditz"); s.quests.push("q1");
    const text = exportSlotText(s);
    expect(JSON.parse(text).v).toBe(SAVE_VERSION);
    const back = openSave(text);
    expect(back?.zeni).toBe(98765);
    expect(back?.defeated).toContain("raditz");
    expect(back?.quests).toContain("q1");
  });
  it("accepts legacy unversioned saves (v1) without losing progress", () => {
    const legacy = JSON.stringify({ zeni: 4321, level: 1, xp: 0, customForms: [] });
    const back = openSave(legacy);
    expect(back?.zeni).toBe(4321);
    expect(back?.forms).toEqual(["base"]);
  });
  it("rejects garbage text at every layer", () => {
    expect(openSave("not json")).toBeNull();
    expect(openSave("[1,2]")).toBeNull();
    expect(openSave("{}")).not.toBeNull(); // empty object is a valid (fresh) v1 save
    expect(openSave('{"v": 2, "data": "nope"}')).not.toBeNull(); // bad data falls back to defaults, not crash
    expect(openSave(null)).toBeNull();
  });
  it("hydrate clamps absurd numbers and dedupes string arrays", () => {
    const s = hydrate({ zeni: Number.POSITIVE_INFINITY, tp: 5e30, dragonBalls: 9999, gravity: 1e100, gaps: undefined, forms: ["base", "base", "ssj1", "ssj1", "ssj1"], quests: ["q1", "q1", "q2"] } as never);
    expect(s.zeni).toBe(0);
    expect(s.tp).toBe(MAX_SAVE_NUMBER);
    expect(s.dragonBalls).toBe(7);
    expect(s.gravity).toBeLessThanOrEqual(1000);
    expect(s.forms).toEqual(["base", "ssj1"]);
    expect(s.quests).toEqual(["q1", "q2"]);
  });
  it("removes NaN and Infinity from every persisted currency", () => {
    const s = fresh(); s.zeni = Number.NaN; s.tp = Number.POSITIVE_INFINITY; s.stamina = Number.NaN;
    const out = hydrate(s);
    expect(Number.isFinite(out.zeni)).toBe(true);
    expect(Number.isFinite(out.tp)).toBe(true);
    expect(out.stamina).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(powerLevel(out))).toBe(true);
  });
  it("power level saturates instead of overflowing to Infinity", () => {
    const s = fresh();
    s.stats.strength = MAX_SAVE_NUMBER; s.stats.agility = MAX_SAVE_NUMBER;
    s.stats.ki = MAX_SAVE_NUMBER; s.stats.defense = MAX_SAVE_NUMBER;
    s.forms = ["ui"]; s.activeForm = "ui";
    expect(powerLevel(s)).toBeLessThanOrEqual(MAX_SAVE_NUMBER);
    expect(Number.isFinite(powerLevel(s))).toBe(true);
  });
});

describe("save integrity — slot resolution & backup recovery", () => {
  it("slot keys are isolated between main and sandbox", () => {
    expect(slotKey("main")).toBe(MAIN_KEY);
    expect(slotKey("sandbox")).toBe(SANDBOX_KEY);
    expect(backupKey("main")).toBe(MAIN_KEY + BACKUP_SUFFIX);
    expect(slotKey("main")).not.toBe(slotKey("sandbox"));
  });
  const goodSave = (zeni: number) => sealSave({ ...fresh(), zeni });
  it("prefers the primary save when both parse", () => {
    const r = resolveInitialLoad(goodSave(111), goodSave(222));
    expect(r.state?.zeni).toBe(111);
    expect(r.recoveredFromBackup).toBe(false);
  });
  it("recovers from the backup when the primary is corrupt", () => {
    const r = resolveInitialLoad("{{{ corrupt", goodSave(222));
    expect(r.state?.zeni).toBe(222);
    expect(r.recoveredFromBackup).toBe(true);
  });
  it("reports total loss when both are corrupt", () => {
    const r = resolveInitialLoad("nope", "alsonope");
    expect(r.state).toBeNull();
    expect(r.recoveredFromBackup).toBe(false);
  });
});

describe("save integrity — shop & wish transactions", () => {
  it("BUY_PASS debits TP once, logs the transaction, and refuses double-buys", () => {
    const s = fresh(); s.tp = 1000;
    applyAction(s, { type: "BUY_PASS", passId: "x2" });
    expect(s.tp).toBe(975);
    expect(s.passes).toContain("x2");
    expect(s.transactions.at(-1)?.currency).toBe("tp");
    expect(s.transactions.at(-1)?.kind).toBe("debit");
    applyAction(s, { type: "BUY_PASS", passId: "x2" });
    expect(s.tp).toBe(975);
  });
  it("BUY_PASS refuses when TP is insufficient", () => {
    const s = fresh(); s.tp = 10;
    applyAction(s, { type: "BUY_PASS", passId: "vip" });
    expect(s.passes).not.toContain("vip");
    expect(s.tp).toBe(10);
  });
  it("MAKE_WISH demands 7 balls and pays exactly once", () => {
    const s = fresh(); s.dragonBalls = 7; const before = s.tp;
    applyAction(s, { type: "MAKE_WISH", wishId: "tp" });
    expect(s.tp).toBe(before + 500);
    expect(s.dragonBalls).toBe(0);
    const after = s.tp;
    applyAction(s, { type: "MAKE_WISH", wishId: "tp" });
    expect(s.tp).toBe(after); // second wish denied: no balls left
  });
  it("MAKE_WISH 'power' doubles every stat and consumes the balls", () => {
    const s = fresh(); s.dragonBalls = 7; s.stats.strength = 50; s.stats.ki = 8;
    applyAction(s, { type: "MAKE_WISH", wishId: "power" });
    expect(s.stats.strength).toBe(100);
    expect(s.stats.ki).toBe(16);
    expect(s.dragonBalls).toBe(0);
  });
  it("MAKE_WISH 'stamina' permanently raises the cap through the TICK path", () => {
    const s = fresh(); s.dragonBalls = 7; s.maxStamina = 100; s.stamina = 100;
    applyAction(s, { type: "MAKE_WISH", wishId: "stamina" });
    expect(s.maxStaminaBonus).toBe(50);
    expect(s.maxStamina).toBe(150);
    applyAction(s, { type: "TICK" });
    expect(s.maxStamina).toBe(150);
  });
  it("boss victory rewards land in the transaction ledger", () => {
    const s = fresh(); s.tp = 0;
    applyBattleRewards(s, { id: "raditz", name: "Raditz", hp: 1500, atk: 10, zeni: 3000, tp: 10, req: 0, emoji: "🦹" }, false);
    expect(s.zeni).toBe(3000);
    expect(s.tp).toBe(10);
    expect(s.transactions.some((t) => t.label.includes("Raditz"))).toBe(true);
  });
  it("ledger caps at MAX_TRANSACTIONS and drops malformed rows on load", () => {
    const loaded = hydrate({ ...fresh(), transactions: Array.from({ length: MAX_TRANSACTIONS + 50 }, (_, i) => ({ id: `t${i}`, at: i, kind: i % 2 ? "credit" : "debit", currency: "tp", amount: 1, label: "x", balance: 1 })) });
    expect(loaded.transactions.length).toBeLessThanOrEqual(MAX_TRANSACTIONS);
    const broken = hydrate({ transactions: [{ garbage: true }, null, { id: "ok", at: 1, kind: "credit", currency: "zeni", amount: 5, label: "ok", balance: 5 }] });
    expect(broken.transactions).toHaveLength(1);
    expect(broken.transactions[0]?.id).toBe("ok");
  });
});

describe("save integrity — infinite zeni override is honest", () => {
  it("bypasses form unlock costs without erasing the player's Zeni", () => {
    const s = fresh();
    s.zeni = 0;
    s.stats.strength = 9000; s.level = 9;
    s.infiniteZeni = true;
    expect(s.zeni).toBe(0); // update() no longer clobbers the wallet
    applyAction(s, { type: "UNLOCK_FORM", formId: "kaioken" });
    expect(s.forms).toContain("kaioken");
    expect(s.zeni).toBe(0);
  });
});

describe("snapshots — schema-versioned time reversal foundation", () => {
  it("round-trips through serialize/parse", () => {
    const s = fresh(); s.zeni = 777; s.defeated.push("frieza");
    const snap = createSnapshot(s, "Before cell fight", "main", 1234567890);
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    const back = parseSnapshot(serializeSnapshot(snap));
    expect(back?.name).toBe("Before cell fight");
    expect(back?.state.zeni).toBe(777);
    expect(back?.state.defeated).toContain("frieza");
    expect(back?.createdAt).toBe(1234567890);
  });
  it("rejects tampered or malformed snapshots instead of crashing", () => {
    expect(parseSnapshot("not json")).toBeNull();
    expect(parseSnapshot('{"name": "x"}')).not.toBeNull(); // missing state → hydrated defaults, never throws
    expect(parseSnapshot('"a string"')).toBeNull();
  });
  it("lists are capped and garbage entries are dropped", () => {
    const s = fresh();
    const good = serializeSnapshot(createSnapshot(s, "ok", "main"));
    const parsed = parseSnapshotList(`[${good}, 42, null, "junk"]`);
    expect(parsed).toHaveLength(1);
    expect(parseSnapshotList("definitely not json")).toEqual([]);
  });
});

describe("extreme-number guard", () => {
  it("clampSaveNumber rejects NaN, Infinity and negatives", () => {
    expect(clampSaveNumber(Number.NaN, 7)).toBe(7);
    expect(clampSaveNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampSaveNumber(-5)).toBe(0);
    expect(clampSaveNumber(1e100)).toBe(MAX_SAVE_NUMBER);
    expect(clampSaveNumber(42)).toBe(42);
  });
});
