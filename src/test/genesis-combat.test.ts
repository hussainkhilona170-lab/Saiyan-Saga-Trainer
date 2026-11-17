import { describe, expect, it } from "vitest";
import {
  applyDamage,
  createCombatant,
  facingVector,
  kiBlastHits,
  meleeHits,
  planarDistance,
  spendKi,
  MELEE_DAMAGE,
  MELEE_RANGE,
} from "@/genesis/sim/combat";

describe("genesis combat", () => {
  it("creates a living combatant at full resources", () => {
    const c = createCombatant(80, 40);
    expect(c.hp).toBe(80);
    expect(c.maxHp).toBe(80);
    expect(c.ki).toBe(40);
    expect(c.alive).toBe(true);
  });

  it("melee connects in front within range", () => {
    const attacker = { x: 0, z: 0, facing: 0 }; // faces +Z
    expect(meleeHits(attacker, { x: 0, z: 1 })).toBe(true);
  });

  it("melee misses targets behind the attacker", () => {
    const attacker = { x: 0, z: 0, facing: 0 };
    expect(meleeHits(attacker, { x: 0, z: -1 })).toBe(false);
  });

  it("melee misses targets out of range", () => {
    const attacker = { x: 0, z: 0, facing: 0 };
    expect(meleeHits(attacker, { x: 0, z: MELEE_RANGE + 0.5 })).toBe(false);
  });

  it("melee misses a target at the attacker's feet", () => {
    const attacker = { x: 0, z: 0, facing: 0 };
    expect(meleeHits(attacker, { x: 0, z: 0 })).toBe(false);
  });

  it("applyDamage reduces hp and marks dead at zero", () => {
    const c = createCombatant(20);
    const hurt = applyDamage(c, 12);
    expect(hurt.hp).toBe(8);
    expect(hurt.alive).toBe(true);
    const dead = applyDamage(hurt, 20);
    expect(dead.hp).toBe(0);
    expect(dead.alive).toBe(false);
  });

  it("spendKi returns null when insufficient", () => {
    const c = createCombatant(50, 10);
    expect(spendKi(c, 15)).toBeNull();
    const ok = spendKi(c, 5);
    expect(ok?.ki).toBe(5);
  });

  it("facingVector is unit length", () => {
    const v = facingVector(Math.PI / 4);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1, 5);
  });

  it("planarDistance is symmetric", () => {
    expect(planarDistance({ x: 1, z: 2 }, { x: 4, z: 6 })).toBeCloseTo(
      planarDistance({ x: 4, z: 6 }, { x: 1, z: 2 }),
      5,
    );
  });

  it("ki blast hits within range", () => {
    expect(kiBlastHits({ x: 0, z: 0 }, { x: 0, z: 5 })).toBe(true);
    expect(kiBlastHits({ x: 0, z: 0 }, { x: 0, z: 100 })).toBe(false);
  });
});
