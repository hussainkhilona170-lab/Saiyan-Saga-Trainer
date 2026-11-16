/**
 * Genesis — character simulation. Pure TypeScript: no three.js, no React, no DOM.
 * The renderer applies this state to meshes; tests run it headless.
 * Units: meters, seconds, radians. Y is up; the ground plane is at y = 0.
 * (Phase 1 spike: kinematic sim on an infinite ground plane. Phase 2 replaces
 * ground collision with @react-three/rapier and adds the real controller feel.)
 */

export type CharacterAction = "idle" | "walk" | "run" | "jump" | "fall" | "land";

/** World-space movement intent. Camera-relative conversion happens in the render layer. */
export type CharacterInput = {
  /** Movement direction, world space, pre-normalized magnitude 0..1 per axis. */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
};

export type CharacterState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Yaw the body faces (radians). */
  facing: number;
  grounded: boolean;
  action: CharacterAction;
  /** Seconds left in the landing recovery window. */
  landTimer: number;
};

export const WALK_SPEED = 4;
export const RUN_SPEED = 8;
export const JUMP_SPEED = 7.5;
export const GRAVITY = 22;
/** Fraction of ground steering available mid-air. */
export const AIR_CONTROL = 0.35;
export const LAND_RECOVERY = 0.12;
/** Clamp dt so a tab-out frame can never tunnel through the floor. */
export const MAX_DT = 0.05;

const EPSILON = 1e-4;

export function createCharacterState(): CharacterState {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 0,
    grounded: true,
    action: "idle",
    landTimer: 0,
  };
}

function magnitude(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

/** Advance the character by dt seconds. Pure: returns a new state, never mutates. */
export function updateCharacter(
  prev: CharacterState,
  input: CharacterInput,
  rawDt: number,
): CharacterState {
  const dt = Math.min(Math.max(rawDt, 0), MAX_DT);
  const s: CharacterState = { ...prev };
  const moveMag = magnitude(input.moveX, input.moveZ);

  // Face the movement direction along the shortest arc.
  if (moveMag > EPSILON) {
    const target = Math.atan2(input.moveX, input.moveZ);
    let diff = target - s.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.facing += diff * Math.min(1, dt * 14);
  }

  const targetSpeed = input.sprint ? RUN_SPEED : WALK_SPEED;
  // Normalize the input direction to at most unit length, then scale by the
  // target speed: full tilt = full speed, half tilt = proportional (analog-ready).
  const dirScale = moveMag > 1 ? 1 / moveMag : 1;
  const wantVx = input.moveX * dirScale * targetSpeed;
  const wantVz = input.moveZ * dirScale * targetSpeed;

  if (s.grounded) {
    if (s.landTimer > 0) {
      // Landing recovery: body is briefly rooted (land animation window).
      s.landTimer = Math.max(0, s.landTimer - dt);
      s.vx = 0;
      s.vz = 0;
      if (s.landTimer === 0) s.action = "idle";
    } else if (moveMag > EPSILON) {
      s.vx = wantVx;
      s.vz = wantVz;
      s.action = input.sprint ? "run" : "walk";
    } else {
      s.vx = 0;
      s.vz = 0;
      s.action = "idle";
    }
    if (input.jump && s.landTimer === 0) {
      s.vy = JUMP_SPEED;
      s.grounded = false;
      s.action = "jump";
    }
  } else {
    // Airborne: keep momentum, allow weakened steering toward the target velocity.
    if (moveMag > EPSILON) {
      const k = Math.min(1, dt * 14) * AIR_CONTROL;
      s.vx += (wantVx - s.vx) * k;
      s.vz += (wantVz - s.vz) * k;
    }
    s.vy -= GRAVITY * dt;
    s.action = s.vy > 0 ? "jump" : "fall";
  }

  s.x += s.vx * dt;
  s.z += s.vz * dt;
  s.y += s.vy * dt;

  // Ground plane collision (Phase 2 replaces with Rapier colliders).
  if (s.y <= 0) {
    s.y = 0;
    if (!s.grounded) {
      s.grounded = true;
      if (s.vy < -1) {
        s.action = "land";
        s.landTimer = LAND_RECOVERY;
      } else {
        s.action = "idle";
      }
    }
    if (s.vy < 0) s.vy = 0;
  }
  return s;
}
