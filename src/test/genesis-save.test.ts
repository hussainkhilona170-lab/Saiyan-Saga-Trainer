import { describe, expect, it } from "vitest";
import { parseSave, SAVE_VERSION, serializeSave } from "@/genesis/sim/save";

describe("genesis save", () => {
  it("round-trips a save", () => {
    const s = {
      version: SAVE_VERSION,
      level: 3,
      xp: 42,
      x: 1.5,
      y: 0,
      z: -2,
      hp: 77,
      ki: 50,
    };
    const raw = serializeSave(s);
    const parsed = parseSave(raw);
    expect(parsed).toEqual(s);
  });

  it("rejects unknown versions", () => {
    const raw = JSON.stringify({
      version: 999,
      level: 1,
      xp: 0,
      x: 0,
      y: 0,
      z: 0,
      hp: 100,
      ki: 100,
    });
    expect(parseSave(raw)).toBeNull();
  });

  it("rejects malformed json", () => {
    expect(parseSave("{not json")).toBeNull();
    expect(parseSave(null)).toBeNull();
  });

  it("clamps negative level/xp", () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      level: -5,
      xp: -10,
      x: 0,
      y: 0,
      z: 0,
      hp: 100,
      ki: 100,
    });
    const p = parseSave(raw);
    expect(p?.level).toBe(1);
    expect(p?.xp).toBe(0);
  });
});
