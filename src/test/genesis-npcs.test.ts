import { describe, expect, it } from "vitest";
import {
  GENESIS_NPCS,
  NPC_INTERACT_RANGE,
  dialogueLine,
  nearestNpc,
  nextLineIndex,
  npcByID,
  npcFacingYaw,
} from "../genesis/sim/npcs";

const oren = GENESIS_NPCS[0]!;

describe("Genesis NPC roster", () => {
  it("ships a mentor with a name, lines and a home position", () => {
    expect(GENESIS_NPCS.length).toBeGreaterThanOrEqual(1);
    expect(new Set(GENESIS_NPCS.map((npc) => npc.id)).size).toBe(GENESIS_NPCS.length);
    for (const npc of GENESIS_NPCS) {
      expect(npc.name.length).toBeGreaterThan(0);
      expect(npc.lines.length).toBeGreaterThan(0);
      expect(Number.isFinite(npc.x)).toBe(true);
      expect(Number.isFinite(npc.z)).toBe(true);
    }
    expect(npcByID(oren.id)).toBe(oren);
    expect(npcByID("missing")).toBeUndefined();
  });
});

describe("Genesis NPC proximity", () => {
  it("returns the closest NPC inside the interact range", () => {
    const near = nearestNpc({ x: oren.x + 1, z: oren.z });
    expect(near?.npc.id).toBe(oren.id);
    expect(near?.distance).toBeCloseTo(1, 6);
  });

  it("returns null outside the interact range", () => {
    expect(nearestNpc({ x: oren.x + NPC_INTERACT_RANGE + 0.1, z: oren.z })).toBeNull();
  });

  it("guards non-finite positions and invalid ranges", () => {
    expect(nearestNpc({ x: Number.NaN, z: 0 })).toBeNull();
    // Invalid range falls back to the default instead of disabling the NPC.
    const near = nearestNpc({ x: oren.x, z: oren.z }, Number.NaN);
    expect(near?.npc.id).toBe(oren.id);
  });

  it("picks the closest of several candidates", () => {
    const second = { ...oren, id: "second", x: oren.x + 2, z: oren.z };
    const near = nearestNpc({ x: oren.x + 1.9, z: oren.z }, NPC_INTERACT_RANGE, [oren, second]);
    expect(near?.npc.id).toBe("second");
  });
});

describe("Genesis NPC dialogue", () => {
  it("cycles through every line and wraps", () => {
    const count = oren.lines.length;
    let index = 0;
    const seen: string[] = [];
    for (let i = 0; i < count; i++) {
      index = nextLineIndex(index, count);
      seen.push(dialogueLine(oren, index));
    }
    expect(seen).toEqual([...oren.lines.slice(1), oren.lines[0]]);
    expect(nextLineIndex(count - 1, count)).toBe(0);
  });

  it("guards empty line lists and invalid indices", () => {
    expect(nextLineIndex(3, 0)).toBe(0);
    expect(nextLineIndex(Number.NaN, 4)).toBe(0);
    expect(nextLineIndex(-2, 4)).toBe(0);
    expect(dialogueLine({ ...oren, lines: [] }, 0)).toBe("");
    expect(dialogueLine(oren, -1)).toBe(oren.lines[0]);
    expect(dialogueLine(oren, 1e6)).toBe(oren.lines[1e6 % oren.lines.length]);
  });

  it("turns to face the player only while they are in range", () => {
    expect(npcFacingYaw(oren, { x: oren.x, z: oren.z + 1 })).toBeCloseTo(0, 6);
    expect(npcFacingYaw(oren, null)).toBe(oren.yaw);
    expect(npcFacingYaw(oren, { x: oren.x + 20, z: oren.z })).toBe(oren.yaw);
    expect(npcFacingYaw(oren, { x: Number.NaN, z: 0 })).toBe(oren.yaw);
  });
});
