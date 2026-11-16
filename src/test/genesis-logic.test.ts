import { describe, expect, it } from "vitest";
import { CHARACTERS, characterByID, nextCharacterID } from "@/genesis/characters";
import { resolveCameraPosition } from "@/genesis/render/cameraRelative";

describe("genesis characters", () => {
  it("has a non-empty roster with unique ids", () => {
    expect(CHARACTERS.length).toBeGreaterThan(1);
    const ids = CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("characterByID returns the matching entry", () => {
    for (const c of CHARACTERS) {
      expect(characterByID(c.id)).toBe(c);
    }
  });

  it("characterByID falls back to the first character for unknown ids", () => {
    expect(characterByID("nope")).toBe(CHARACTERS[0]!);
  });

  it("nextCharacterID cycles through the roster and wraps", () => {
    let id = CHARACTERS[0]!.id;
    const seen = new Set<string>();
    for (let i = 0; i < CHARACTERS.length; i++) {
      seen.add(id);
      id = nextCharacterID(id);
    }
    expect(seen.size).toBe(CHARACTERS.length);
    expect(id).toBe(CHARACTERS[0]!.id);
  });

  it("every character has a positive scale and hex palette", () => {
    for (const c of CHARACTERS) {
      expect(c.scale).toBeGreaterThan(0);
      expect(c.gi).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.hair).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.skin).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("genesis camera collision", () => {
  const target = { x: 0, y: 1, z: 0 };
  const desired = { x: 0, y: 3, z: 5 };

  it("returns the desired position on a miss (no hit)", () => {
    expect(resolveCameraPosition(target, desired, null)).toEqual(desired);
  });

  it("pulls the camera in on a hit", () => {
    const pos = resolveCameraPosition(target, desired, 0.4);
    const dist = Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z);
    const full = Math.hypot(desired.x - target.x, desired.y - target.y, desired.z - target.z);
    expect(dist).toBeLessThan(full);
    expect(dist).toBeGreaterThan(0);
  });

  it("a very close hit hugs the target", () => {
    const pos = resolveCameraPosition(target, desired, 0.05);
    const dist = Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z);
    expect(dist).toBeLessThan(1);
  });

  it("clamps out-of-range hitToi gracefully", () => {
    const far = resolveCameraPosition(target, desired, 5);
    expect(far).toEqual(desired);
    const nan = resolveCameraPosition(target, desired, Number.NaN);
    expect(nan).toEqual(desired);
  });

  it("never places the camera behind the target (toi > 0)", () => {
    const pos = resolveCameraPosition(target, desired, 0.1);
    const dot =
      (pos.x - target.x) * (desired.x - target.x) +
      (pos.y - target.y) * (desired.y - target.y) +
      (pos.z - target.z) * (desired.z - target.z);
    expect(dot).toBeGreaterThanOrEqual(0);
  });
});
