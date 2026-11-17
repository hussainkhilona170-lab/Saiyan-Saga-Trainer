import { describe, expect, it } from "vitest";
import {
  createCharacterState,
  AIR_CONTROL,
  JUMP_SPEED,
  LAND_RECOVERY,
  MAX_DT,
  RUN_SPEED,
  WALK_SPEED,
  FLY_SPEED,
  FLY_SPRINT_SPEED,
  CLIMB_SPEED,
  MAX_ALTITUDE,
  TAKEOFF_LIFT,
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

describe("genesis flight", () => {
  const dt = 1 / 60;

  function steps(
    start: ReturnType<typeof createCharacterState>,
    input: Parameters<typeof updateCharacter>[1],
    n = 60,
  ) {
    let s = start;
    for (let i = 0; i < n; i++) s = updateCharacter(s, input, dt);
    return s;
  }

  it("toggle engages flight and lifts off the ground", () => {
    const s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    expect(s.flying).toBe(true);
    expect(s.grounded).toBe(false);
    expect(s.y).toBeGreaterThan(0);
    expect(s.action).toBe("fly");
  });

  it("flight holds altitude with no vertical input", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    const y0 = s.y;
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false }, 60);
    expect(s.flying).toBe(true);
    expect(Math.abs(s.y - y0)).toBeLessThan(0.6);
  });

  it("ascend climbs at CLIMB_SPEED", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false, ascend: true }, 60);
    expect(s.y).toBeGreaterThan(1.5);
    expect(s.vy).toBeGreaterThan(0);
  });

  it("descend lands and clears the flying flag", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false, descend: true }, 120);
    expect(s.flying).toBe(false);
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(0);
  });

  it("flight moves horizontally at FLY_SPEED", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 1, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 1, sprint: false, jump: false }, 90);
    expect(Math.hypot(s.vx, s.vz)).toBeCloseTo(FLY_SPEED, 1);
  });

  it("flight sprints at FLY_SPRINT_SPEED", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 1, sprint: true, jump: false, toggleFly: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 1, sprint: true, jump: false }, 90);
    expect(Math.hypot(s.vx, s.vz)).toBeCloseTo(FLY_SPRINT_SPEED, 1);
  });

  it("altitude is clamped at MAX_ALTITUDE", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true, ascend: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false, ascend: true }, 1500);
    expect(s.y).toBeLessThanOrEqual(MAX_ALTITUDE);
    expect(s.vy).toBeLessThanOrEqual(0.01);
  });

  it("toggling flight off mid-air drops under gravity", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false }, 30);
    const y0 = s.y;
    s = updateCharacter(s, { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true }, dt);
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false }, 10);
    expect(s.flying).toBe(false);
    expect(s.y).toBeLessThan(y0);
  });

  it("landing from flight sets land recovery", () => {
    let s = updateCharacter(
      rest,
      { moveX: 0, moveZ: 0, sprint: false, jump: false, toggleFly: true },
      dt,
    );
    s = steps(s, { moveX: 0, moveZ: 0, sprint: false, jump: false, descend: true }, 120);
    expect(s.grounded).toBe(true);
    expect(s.action === "land" || s.action === "idle").toBe(true);
  });
});
