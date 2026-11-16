import { describe, expect, it } from "vitest";
import {
  createCharacterState,
  AIR_CONTROL,
  JUMP_SPEED,
  LAND_RECOVERY,
  MAX_DT,
  RUN_SPEED,
  WALK_SPEED,
  updateCharacter,
} from "@/genesis/sim/character";

const rest = createCharacterState();
const noInput = { moveX: 0, moveZ: 0, sprint: false, jump: false };
const dt = 1 / 60;

function run(state = rest, input = noInput, steps = 1, step = dt) {
  let s = state;
  for (let i = 0; i < steps; i++) s = updateCharacter(s, input, step);
  return s;
}

function speed(s: { vx: number; vz: number }) {
  return Math.hypot(s.vx, s.vz);
}

/** Steps until the character has landed (action "land") or maxSteps run out. */
function landOf(start = rest) {
  let s = updateCharacter(start, { moveX: 0, moveZ: 0, sprint: false, jump: true }, dt);
  for (let i = 0; i < 200 && !(s.grounded && s.action === "land"); i++) {
    s = updateCharacter(s, noInput, dt);
  }
  return s;
}

describe("genesis character sim", () => {
  it("starts idle and grounded at the origin", () => {
    expect(rest.action).toBe("idle");
    expect(rest.grounded).toBe(true);
    expect(rest.x).toBe(0);
    expect(rest.y).toBe(0);
  });

  it("holds position with no input", () => {
    const s = run(rest, noInput, 30);
    expect(s.action).toBe("idle");
    expect(speed(s)).toBe(0);
    expect(s.x).toBe(0);
  });

  it("walks at WALK_SPEED", () => {
    const s = run(rest, { moveX: 0, moveZ: 1, sprint: false, jump: false }, 10);
    expect(s.action).toBe("walk");
    expect(speed(s)).toBeCloseTo(WALK_SPEED, 5);
  });

  it("scales speed proportionally for partial input", () => {
    const s = run(rest, { moveX: 0, moveZ: 0.5, sprint: false, jump: false }, 10);
    expect(s.action).toBe("walk");
    expect(speed(s)).toBeCloseTo(WALK_SPEED * 0.5, 5);
  });

  it("runs at RUN_SPEED while sprinting", () => {
    const s = run(rest, { moveX: 0, moveZ: 1, sprint: true, jump: false }, 10);
    expect(s.action).toBe("run");
    expect(speed(s)).toBeCloseTo(RUN_SPEED, 5);
  });

  it("clamps over-long input vectors to full speed", () => {
    const s = run(rest, { moveX: 3, moveZ: 4, sprint: false, jump: false }, 10);
    expect(speed(s)).toBeCloseTo(WALK_SPEED, 5);
  });

  it("jumps with JUMP_SPEED and rises", () => {
    let s = run(rest, { moveX: 0, moveZ: 0, sprint: false, jump: true });
    expect(s.grounded).toBe(false);
    expect(s.vy).toBeCloseTo(JUMP_SPEED, 5);
    expect(s.action).toBe("jump");
    s = run(s, noInput, 3);
    expect(s.y).toBeGreaterThan(0);
  });

  it("gravity brings the character back down and enters land recovery", () => {
    const s = landOf();
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(0);
    expect(s.action).toBe("land");
    expect(s.landTimer).toBeGreaterThan(0);
  });

  it("land recovery ends back in idle", () => {
    let s = landOf();
    s = run(s, noInput, Math.ceil(LAND_RECOVERY / dt) + 2);
    expect(s.landTimer).toBe(0);
    expect(s.action).toBe("idle");
  });

  it("air steering is weaker than ground steering", () => {
    const air = run(rest, { moveX: 0, moveZ: 0, sprint: false, jump: true });
    const steered = run(air, { moveX: 1, moveZ: 0, sprint: false, jump: false }, 1);
    expect(steered.vx).toBeLessThan(WALK_SPEED * AIR_CONTROL * 2);
  });

  it("faces the movement direction", () => {
    const s = run(rest, { moveX: 1, moveZ: 0, sprint: false, jump: false }, 60);
    expect(Math.abs(s.facing - Math.PI / 2)).toBeLessThan(0.05);
  });

  it("clamps huge dt without tunneling below the ground", () => {
    let s = run(rest, { moveX: 0, moveZ: 0, sprint: false, jump: true }); // now airborne
    let steps = 0;
    while (!s.grounded && steps < 40) {
      s = updateCharacter(s, noInput, 10); // one 10-second frame per step
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(0); // never tunnels
      steps++;
    }
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(0);
  });

  it("never moves further than speed * MAX_DT in a single clamped step", () => {
    const before = run(rest, { moveX: 0, moveZ: 1, sprint: true, jump: false }, 1);
    const step = updateCharacter(before, { moveX: 0, moveZ: 1, sprint: true, jump: false }, MAX_DT);
    expect(Math.hypot(step.x - before.x, step.z - before.z)).toBeCloseTo(RUN_SPEED * MAX_DT, 5);
  });
});
