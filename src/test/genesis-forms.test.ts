import { describe, expect, it } from "vitest";
import {
  GENESIS_FORMS,
  canEnterForm,
  drainFormKi,
  formByID,
  formDamage,
  formSpeed,
} from "../genesis/sim/forms";
import {
  createCharacterState,
  updateCharacter,
  WALK_SPEED,
  RUN_SPEED,
} from "../genesis/sim/character";

const ascended = GENESIS_FORMS[0]!;

describe("Genesis forms", () => {
  it("ships a valid transformation", () => {
    expect(GENESIS_FORMS.length).toBeGreaterThanOrEqual(1);
    for (const form of GENESIS_FORMS) {
      expect(form.name.length).toBeGreaterThan(0);
      expect(form.damageMult).toBeGreaterThan(1);
      expect(form.speedMult).toBeGreaterThan(1);
      expect(form.kiDrain).toBeGreaterThan(0);
      expect(form.cost).toBeGreaterThan(0);
      expect(form.minLevel).toBeGreaterThanOrEqual(1);
    }
    expect(formByID(ascended.id)).toBe(ascended);
    expect(formByID(null)).toBeUndefined();
    expect(formByID("missing")).toBeUndefined();
  });

  it("enters when the level and Ki allow it, paying the cost", () => {
    const attempt = canEnterForm(ascended, 5, 50);
    expect(attempt.ok).toBe(true);
    if (attempt.ok) {
      expect(attempt.form.id).toBe(ascended.id);
      expect(attempt.ki).toBe(50 - ascended.cost);
    }
  });

  it("refuses on level, Ki, an active form, or an unknown form", () => {
    expect(canEnterForm(ascended, 0, 100)).toEqual({ ok: false, reason: "level" });
    expect(canEnterForm(ascended, 5, ascended.cost - 1)).toEqual({ ok: false, reason: "ki" });
    expect(canEnterForm(ascended, 5, 100, ascended.id)).toEqual({ ok: false, reason: "already" });
    expect(canEnterForm(undefined, 5, 100)).toEqual({ ok: false, reason: "unknown" });
    // Non-finite inputs are treated as zero, never as "everything allowed".
    expect(canEnterForm(ascended, Number.NaN, Number.NaN)).toEqual({ ok: false, reason: "level" });
  });

  it("drains Ki and collapses when it runs out", () => {
    const drain = drainFormKi(ascended, 10, 0.5);
    expect(drain.ki).toBeCloseTo(10 - ascended.kiDrain * 0.05, 6);
    expect(drain.active).toBe(true);

    const empty = drainFormKi(ascended, 0.01, 0.05);
    expect(empty.ki).toBe(0);
    expect(empty.active).toBe(false);

    // Absurd dt is clamped like the rest of the sim.
    const huge = drainFormKi(ascended, 100, 10);
    expect(huge.ki).toBeCloseTo(100 - ascended.kiDrain * 0.05, 6);
    expect(drainFormKi(undefined, 10, 0.016)).toEqual({ ki: 10, active: false });
    expect(drainFormKi(ascended, Number.NaN, Number.NaN)).toEqual({ ki: 0, active: false });
  });

  it("scales damage and speed while transformed, and is neutral without a form", () => {
    expect(formDamage(10, undefined)).toBe(10);
    expect(formDamage(10, ascended)).toBeCloseTo(16, 6);
    expect(formDamage(Number.NaN, ascended)).toBe(0);
    expect(formSpeed(8, undefined)).toBe(8);
    expect(formSpeed(8, ascended)).toBeCloseTo(10, 6);
  });
});

describe("Genesis form movement", () => {
  it("moves faster on the ground while transformed", () => {
    const start = createCharacterState();
    const walk = updateCharacter(start, { moveX: 0, moveZ: 1, sprint: false, jump: false }, 0.016);
    expect(walk.vz).toBeCloseTo(WALK_SPEED, 6);

    const boosted = updateCharacter(
      start,
      { moveX: 0, moveZ: 1, sprint: false, jump: false, speedMult: ascended.speedMult },
      0.016,
    );
    expect(boosted.vz).toBeCloseTo(WALK_SPEED * ascended.speedMult, 6);

    const sprint = updateCharacter(
      start,
      { moveX: 0, moveZ: 1, sprint: true, jump: false, speedMult: 1 },
      0.016,
    );
    expect(sprint.vz).toBeCloseTo(RUN_SPEED, 6);
  });

  it("guards a nonsense speed multiplier", () => {
    const start = createCharacterState();
    const odd = updateCharacter(
      start,
      { moveX: 0, moveZ: 1, sprint: false, jump: false, speedMult: Number.NaN },
      0.016,
    );
    expect(odd.vz).toBeCloseTo(WALK_SPEED, 6);

    const negative = updateCharacter(
      start,
      { moveX: 0, moveZ: 1, sprint: false, jump: false, speedMult: -3 },
      0.016,
    );
    expect(negative.vz).toBeCloseTo(WALK_SPEED, 6);
  });
});
