import { describe, expect, it } from "vitest";
import {
  advancePhase,
  isFinitePose,
  poseFor,
  REST_POSE,
  RUN_CYCLE_DISTANCE,
  smoothPose,
  WALK_CYCLE_DISTANCE,
  type Pose,
} from "@/genesis/sim/animation";
import { RUN_SPEED, WALK_SPEED, type CharacterAction } from "@/genesis/sim/character";

const actions: CharacterAction[] = ["idle", "walk", "run", "jump", "fall", "land", "fly", "attack"];
const dt = 1 / 60;

function poseAt(action: CharacterAction, speed: number, phase: number): Pose {
  return poseFor(action, speed, phase);
}

describe("genesis animation", () => {
  it("produces finite poses for every action across a full gait cycle", () => {
    for (const action of actions) {
      for (let i = 0; i < 24; i++) {
        const pose = poseAt(action, RUN_SPEED, (i / 24) * Math.PI * 2);
        expect(isFinitePose(pose)).toBe(true);
      }
    }
  });

  it("idle stays close to the rest pose (small breathing motion only)", () => {
    for (let i = 0; i < 12; i++) {
      const pose = poseAt("idle", 0, (i / 12) * Math.PI * 2);
      expect(Math.abs(pose.hipsY)).toBeLessThan(0.02);
      expect(Math.abs(pose.hipL)).toBeLessThan(0.1);
      expect(Math.abs(pose.torsoPitch)).toBeLessThan(0.1);
      expect(pose.kneeL).toBeGreaterThan(0);
    }
  });

  it("walk swing scales with ground speed (analog input)", () => {
    const slow = poseAt("walk", WALK_SPEED * 0.5, Math.PI / 2);
    const fast = poseAt("walk", WALK_SPEED, Math.PI / 2);
    expect(Math.abs(fast.hipL)).toBeGreaterThan(Math.abs(slow.hipL));
    // Full speed reaches the authored amplitude.
    expect(fast.hipL).toBeCloseTo(0.54, 5);
  });

  it("walk never overshoots its authored amplitude at silly speeds", () => {
    const pose = poseAt("walk", WALK_SPEED * 50, Math.PI / 2);
    expect(pose.hipL).toBeLessThanOrEqual(0.55);
  });

  it("legs swing in opposition during a gait", () => {
    for (let i = 1; i < 8; i++) {
      const pose = poseAt("run", RUN_SPEED, (i / 8) * Math.PI * 2);
      expect(pose.hipL).toBeCloseTo(-pose.hipR, 5);
      expect(pose.shoulderL).toBeCloseTo(-pose.shoulderR, 5);
    }
  });

  it("arms counter-swing the legs", () => {
    const pose = poseAt("run", RUN_SPEED, Math.PI / 2);
    // Left leg forward (positive hip) means the left arm swings back.
    expect(pose.hipL).toBeGreaterThan(0);
    expect(pose.shoulderL).toBeLessThan(0);
    expect(pose.shoulderR).toBeGreaterThan(0);
  });

  it("run leans further forward and bends the arms more than walk", () => {
    const walk = poseAt("walk", WALK_SPEED, 0);
    const run = poseAt("run", RUN_SPEED, 0);
    expect(run.torsoPitch).toBeGreaterThan(walk.torsoPitch);
    expect(run.elbowL).toBeGreaterThan(walk.elbowL);
    expect(Math.abs(run.hipsY - walk.hipsY)).toBeGreaterThan(0);
  });

  it("knees only bend forward (never hyperextend backwards)", () => {
    for (const action of actions) {
      for (let i = 0; i < 16; i++) {
        const pose = poseAt(action, RUN_SPEED, (i / 16) * Math.PI * 2);
        expect(pose.kneeL).toBeGreaterThan(0);
        expect(pose.kneeR).toBeGreaterThan(0);
        expect(pose.kneeL).toBeLessThan(Math.PI);
        expect(pose.kneeR).toBeLessThan(Math.PI);
      }
    }
  });

  it("jump tucks the legs and raises both arms", () => {
    const jump = poseAt("jump", 0, 0);
    const idle = poseAt("idle", 0, 0);
    expect(jump.kneeL).toBeGreaterThan(idle.kneeL + 0.5);
    expect(jump.kneeR).toBeGreaterThan(idle.kneeR + 0.3);
    expect(jump.shoulderL).toBeGreaterThan(1.5);
    expect(jump.shoulderR).toBeGreaterThan(1.5);
  });

  it("land is a deep crouch lower than idle", () => {
    const land = poseAt("land", 0, 0);
    const idle = poseAt("idle", 0, 0);
    expect(land.hipsY).toBeLessThan(idle.hipsY - 0.1);
    expect(land.kneeL).toBeGreaterThan(1);
    expect(land.torsoPitch).toBeGreaterThan(0.3);
  });

  it("gait phase advances faster when running than walking at equal speed", () => {
    let walkPhase = 0;
    let runPhase = 0;
    // Few enough steps that neither clock wraps past a full turn.
    for (let i = 0; i < 5; i++) {
      walkPhase = advancePhase(walkPhase, "walk", WALK_SPEED, dt);
      runPhase = advancePhase(runPhase, "run", WALK_SPEED, dt);
    }
    expect(walkPhase).toBeGreaterThan(runPhase);
    expect(walkPhase).toBeGreaterThan(0);
    expect(runPhase).toBeGreaterThan(0);
    expect(RUN_CYCLE_DISTANCE).toBeGreaterThan(WALK_CYCLE_DISTANCE);
  });

  it("advances exactly one gait cycle per cycle distance travelled", () => {
    // Walk for the duration it takes to cover one full cycle.
    const duration = WALK_CYCLE_DISTANCE / WALK_SPEED;
    const steps = Math.round(duration / dt);
    let phase = 0;
    for (let i = 0; i < steps; i++) phase = advancePhase(phase, "walk", WALK_SPEED, dt);
    // 1/60 s rounding leaves it within a few percent of a full turn (0 or 2π).
    expect(Math.min(phase, Math.PI * 2 - phase)).toBeLessThan(0.12);

    // The run cycle covers a longer stride, so the same time turns less.
    let runPhase = 0;
    for (let i = 0; i < steps; i++) runPhase = advancePhase(runPhase, "run", WALK_SPEED, dt);
    expect(runPhase).toBeGreaterThan(0);
    expect(runPhase).toBeLessThan(phase + Math.PI);
  });

  it("phase always wraps into [0, 2π) and survives bad dt", () => {
    let phase = 0;
    for (let i = 0; i < 200; i++) {
      phase = advancePhase(phase, "run", RUN_SPEED, i % 7 === 0 ? 10 : dt);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI * 2);
      expect(Number.isFinite(phase)).toBe(true);
    }
    expect(Number.isFinite(advancePhase(phase, "run", RUN_SPEED, Number.NaN))).toBe(true);
    expect(Number.isFinite(advancePhase(phase, "run", Number.NaN, dt))).toBe(true);
    expect(Number.isFinite(advancePhase(Number.POSITIVE_INFINITY, "run", RUN_SPEED, dt))).toBe(
      true,
    );
  });

  it("a stationary walk does not advance (speed drives the legs)", () => {
    expect(advancePhase(1.234, "walk", 0, dt)).toBeCloseTo(1.234, 6);
    expect(advancePhase(1.234, "run", 0, dt)).toBeCloseTo(1.234, 6);
  });

  it("smoothPose interpolates without snapping and respects the endpoints", () => {
    const target = poseAt("run", RUN_SPEED, Math.PI / 2);
    expect(smoothPose(REST_POSE, target, 0)).toEqual(REST_POSE);
    expect(smoothPose(REST_POSE, target, 1)).toEqual(target);
    const half = smoothPose(REST_POSE, target, 0.5);
    expect(half.hipL).toBeCloseTo((REST_POSE.hipL + target.hipL) / 2, 6);
    const small = smoothPose(REST_POSE, target, 0.1);
    // A small blend stays far closer to the previous pose than to the target.
    expect(Math.abs(small.hipL - REST_POSE.hipL)).toBeLessThan(Math.abs(target.hipL - small.hipL));
  });

  it("smoothPose clamps out-of-range alpha", () => {
    const target = poseAt("land", 0, 0);
    expect(smoothPose(REST_POSE, target, -5)).toEqual(REST_POSE);
    expect(smoothPose(REST_POSE, target, 5)).toEqual(target);
    expect(isFinitePose(smoothPose(REST_POSE, target, Number.NaN))).toBe(true);
  });
});
