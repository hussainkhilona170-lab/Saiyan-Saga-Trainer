/**
 * Genesis — procedural character animation. Pure TypeScript: no three.js, no React.
 *
 * The fighter body is built from primitives, so every pose is just a set of joint
 * angles. Keeping this pure means animation can be unit-tested headless and later
 * swapped for baked GLTF clips behind the same Pose contract.
 *
 * Angle conventions (all radians):
 * - hip / shoulder: positive = limb swings FORWARD (toward facing)
 * - knee / elbow:   positive = joint bends in its natural direction
 * - torsoPitch:     positive = leans forward
 * - armSpread:      positive = elbows move away from the body
 */
import { RUN_SPEED, WALK_SPEED, type CharacterAction } from "./character";

export type Pose = {
  /** Vertical offset of the hips from the rest height (meters). */
  hipsY: number;
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  shoulderL: number;
  shoulderR: number;
  elbowL: number;
  elbowR: number;
  armSpread: number;
  torsoPitch: number;
  torsoRoll: number;
  headYaw: number;
};

export const REST_POSE: Pose = {
  hipsY: 0,
  hipL: 0.04,
  hipR: 0.04,
  kneeL: 0.1,
  kneeR: 0.1,
  shoulderL: 0.05,
  shoulderR: 0.05,
  elbowL: 0.24,
  elbowR: 0.24,
  armSpread: 0.12,
  torsoPitch: 0.02,
  torsoRoll: 0,
  headYaw: 0,
};

/** Idle breathing rate (rad/s). */
export const IDLE_BREATH_RATE = 1.7;
/** Meters travelled per gait cycle (two steps). */
export const WALK_CYCLE_DISTANCE = 3.4;
export const RUN_CYCLE_DISTANCE = 4.6;
export const FLY_CYCLE_DISTANCE = 6;
/** dt clamp mirrors the character sim so a tab-out frame cannot jump the phase. */
export const MAX_ANIM_DT = 0.05;

const TWO_PI = Math.PI * 2;

const POSE_KEYS = Object.keys(REST_POSE) as Array<keyof Pose>;

export function createPose(): Pose {
  return { ...REST_POSE };
}

function wrapPhase(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  const p = phase % TWO_PI;
  return p < 0 ? p + TWO_PI : p;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Advance the animation clock. Gait phase is driven by distance travelled, not
 * wall time, so footfalls stay planted whether the fighter walks or sprints.
 */
export function advancePhase(
  phase: number,
  action: CharacterAction,
  speed: number,
  rawDt: number,
): number {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), MAX_ANIM_DT) : 0;
  const v = Number.isFinite(speed) ? Math.max(speed, 0) : 0;
  let next = Number.isFinite(phase) ? phase : 0;
  switch (action) {
    case "walk":
      next += (v / WALK_CYCLE_DISTANCE) * TWO_PI * dt;
      break;
    case "run":
      next += (v / RUN_CYCLE_DISTANCE) * TWO_PI * dt;
      break;
    case "fly":
      // Distance-driven limb flutter (thrust) plus a slow idle sway when hovering.
      next += ((v / FLY_CYCLE_DISTANCE) * TWO_PI + 0.6) * dt;
      break;
    case "idle":
      next += IDLE_BREATH_RATE * dt;
      break;
    case "jump":
    case "fall":
      next += 0.5 * dt;
      break;
    case "land":
      break; // landing is a fixed crouch pose
  }
  return wrapPhase(next);
}

function idlePoseInto(out: Pose, phase: number): Pose {
  const breath = Math.sin(phase);
  out.hipsY = 0.012 * breath;
  out.hipL = 0.05;
  out.hipR = 0.05;
  out.kneeL = 0.11 + 0.015 * breath;
  out.kneeR = 0.11 + 0.015 * breath;
  out.shoulderL = 0.04 + 0.03 * breath;
  out.shoulderR = 0.04 - 0.03 * breath;
  out.elbowL = 0.26;
  out.elbowR = 0.26;
  out.armSpread = 0.13;
  out.torsoPitch = 0.03;
  out.torsoRoll = 0.008 * breath;
  out.headYaw = 0;
  return out;
}

function gaitPoseInto(out: Pose, phase: number, speed: number, run: boolean): Pose {
  const swing = Math.sin(phase);
  const scale = Math.min(1, Math.max(0, speed) / (run ? RUN_SPEED : WALK_SPEED));
  const legAmp = (run ? 0.92 : 0.54) * scale;
  const armAmp = (run ? 0.8 : 0.44) * scale;
  const kneeBase = run ? 0.26 : 0.1;
  const kneeAmp = (run ? 0.95 : 0.5) * scale;

  // Two bobs per gait cycle: hips rise as each leg passes under the body.
  out.hipsY = (run ? 0.075 : 0.03) * scale * Math.cos(phase * 2) * 0.5 + (run ? 0.02 : 0);
  out.hipL = swing * legAmp;
  out.hipR = -swing * legAmp;
  // Knee flexes while that leg swings through (legs together), not at heel strike.
  out.kneeL = kneeBase + kneeAmp * Math.max(0, Math.cos(phase));
  out.kneeR = kneeBase + kneeAmp * Math.max(0, -Math.cos(phase));
  // Arms counter-swing the legs.
  out.shoulderL = -swing * armAmp;
  out.shoulderR = swing * armAmp;
  out.elbowL = (run ? 1.05 : 0.42) * scale + 0.12 * swing;
  out.elbowR = (run ? 1.05 : 0.42) * scale - 0.12 * swing;
  out.armSpread = 0.06 + (run ? 0.16 : 0.12) * scale;
  out.torsoPitch = (run ? 0.3 : 0.08) * scale;
  out.torsoRoll = swing * (run ? 0.05 : 0.03) * scale;
  out.headYaw = 0;
  return out;
}

function jumpPoseInto(out: Pose): Pose {
  out.hipsY = 0.04;
  out.hipL = 0.62;
  out.hipR = 0.26;
  out.kneeL = 1.05;
  out.kneeR = 0.58;
  out.shoulderL = 2.05;
  out.shoulderR = 2.0;
  out.elbowL = 0.5;
  out.elbowR = 0.5;
  out.armSpread = 0.32;
  out.torsoPitch = 0.14;
  out.torsoRoll = 0;
  out.headYaw = 0;
  return out;
}

function fallPoseInto(out: Pose): Pose {
  out.hipsY = -0.02;
  out.hipL = 0.34;
  out.hipR = 0.16;
  out.kneeL = 0.5;
  out.kneeR = 0.34;
  out.shoulderL = 1.45;
  out.shoulderR = 1.4;
  out.elbowL = 0.4;
  out.elbowR = 0.4;
  out.armSpread = 0.72;
  out.torsoPitch = -0.08;
  out.torsoRoll = 0;
  out.headYaw = 0;
  return out;
}

function flyPoseInto(out: Pose, phase: number, speed: number): Pose {
  const scale = Math.min(1, Math.max(0, speed) / 12);
  const flutter = Math.sin(phase * 2);
  out.hipsY = 0.03 * scale + 0.01 * flutter * (1 - scale);
  out.hipL = -0.1 - 0.45 * scale;
  out.hipR = -0.06 - 0.4 * scale;
  out.kneeL = 0.35 + 0.25 * scale + 0.05 * flutter;
  out.kneeR = 0.3 + 0.22 * scale - 0.05 * flutter;
  out.shoulderL = -0.9 - 0.5 * scale;
  out.shoulderR = -0.9 - 0.5 * scale;
  out.elbowL = 0.25 + 0.15 * scale;
  out.elbowR = 0.25 + 0.15 * scale;
  out.armSpread = 0.35 + 0.15 * (1 - scale);
  out.torsoPitch = 0.1 + 0.4 * scale;
  out.torsoRoll = 0.02 * Math.sin(phase);
  out.headYaw = 0;
  return out;
}

function landPoseInto(out: Pose): Pose {
  out.hipsY = -0.22;
  out.hipL = 0.56;
  out.hipR = 0.56;
  out.kneeL = 1.12;
  out.kneeR = 1.12;
  out.shoulderL = -0.5;
  out.shoulderR = -0.5;
  out.elbowL = 0.62;
  out.elbowR = 0.62;
  out.armSpread = 0.38;
  out.torsoPitch = 0.5;
  out.torsoRoll = 0;
  out.headYaw = 0;
  return out;
}

/**
 * Write the target pose for an action into `out`. Allocation-free so the render
 * loop can call it every frame; `poseFor` is the allocating convenience wrapper.
 */
export function poseForInto(
  out: Pose,
  action: CharacterAction,
  speed: number,
  phase: number,
): Pose {
  const p = wrapPhase(phase);
  const v = Number.isFinite(speed) ? Math.max(speed, 0) : 0;
  switch (action) {
    case "walk":
      return gaitPoseInto(out, p, v, false);
    case "run":
      return gaitPoseInto(out, p, v, true);
    case "jump":
      return jumpPoseInto(out);
    case "fly":
      return flyPoseInto(out, p, v);
    case "fall":
      return fallPoseInto(out);
    case "land":
      return landPoseInto(out);
    case "idle":
    default:
      return idlePoseInto(out, p);
  }
}

/** Target pose for an action at a given gait phase / ground speed. Pure. */
export function poseFor(action: CharacterAction, speed: number, phase: number): Pose {
  return poseForInto(createPose(), action, speed, phase);
}

/** Exponential pose blend into `out`: removes snapping when actions change. */
export function smoothPoseInto(out: Pose, prev: Pose, target: Pose, alpha: number): Pose {
  const a = clamp01(alpha);
  for (const key of POSE_KEYS) out[key] = prev[key] + (target[key] - prev[key]) * a;
  return out;
}

/** Allocating convenience wrapper around `smoothPoseInto`. */
export function smoothPose(prev: Pose, target: Pose, alpha: number): Pose {
  return smoothPoseInto({ ...prev }, prev, target, alpha);
}

/** True when every joint angle is a finite number (guards against sim corruption). */
export function isFinitePose(pose: Pose): boolean {
  return POSE_KEYS.every((key) => Number.isFinite(pose[key]));
}
