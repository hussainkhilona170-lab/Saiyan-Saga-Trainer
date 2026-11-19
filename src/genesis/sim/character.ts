/**
 * Genesis — character simulation. Pure TypeScript: no three.js, no React, no DOM.
 * The renderer applies this state to meshes; tests run it headless.
 * Units: meters, seconds, radians. Y is up; the ground plane is at y = 0.
 * (Phase 1 spike: kinematic sim on an infinite ground plane. Phase 2 replaces
 * ground collision with @react-three/rapier and adds the real controller feel.)
 */

export type CharacterAction = "idle" | "walk" | "run" | "jump" | "fall" | "land" | "fly" | "attack";

/** World-space movement intent. Camera-relative conversion happens in the render layer. */
export type CharacterInput = {
  /** Movement direction, world space, pre-normalized magnitude 0..1 per axis. */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
  /** Edge-triggered: true on the frame the flight-toggle key went down. */
  toggleFly?: boolean;
  /** Hold to gain altitude while flying. */
  ascend?: boolean;
  /** Hold to lose altitude while flying. */
  descend?: boolean;
  /** Edge-triggered: true on the frame the attack key went down. */
  attack?: boolean;
  /** Multiplier on walk/run/fly speed (transformations). Defaults to 1. */
  speedMult?: number;
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
  /** True while the character is in powered flight. */
  flying: boolean;
  action: CharacterAction;
  /** Seconds left in the landing recovery window. */
  landTimer: number;
  /** Seconds left in the current attack wind-up/recovery. */
  attackTimer: number;
  /** Seconds until the next attack is allowed. */
  attackCooldown: number;
};

export const WALK_SPEED = 4;
export const RUN_SPEED = 8;
export const JUMP_SPEED = 7.5;
export const GRAVITY = 22;
export const FLY_SPEED = 12;
export const FLY_SPRINT_SPEED = 18;
export const CLIMB_SPEED = 5;
export const TAKEOFF_LIFT = 3.5;
export const MAX_ALTITUDE = 60;
export const FLY_ACCEL = 6;
/** Exponential smoothing rate (1/s) toward desired flight velocity. */
export const ATTACK_DURATION = 0.32;
export const ATTACK_COOLDOWN = 0.45;
export const ATTACK_DAMAGE = 10;
export const ATTACK_RANGE = 1.25;
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
    flying: false,
    action: "idle",
    landTimer: 0,
    attackTimer: 0,
    attackCooldown: 0,
  };
}

function magnitude(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

/** Speed multiplier from a transformation; guards garbage and absurd values. */
function speedScale(input: CharacterInput): number {
  const raw = input.speedMult;
  if (!Number.isFinite(raw) || raw === undefined || raw <= 0) return 1;
  return Math.min(Math.max(raw, 0.25), 3);
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

  // Attack timing (cooldown decrements even mid-air; the wind-up locks motion).
  s.attackCooldown = Math.max(0, s.attackCooldown - dt);
  s.attackTimer = Math.max(0, s.attackTimer - dt);
  if (input.attack && s.attackCooldown <= 0 && !s.flying) {
    s.attackTimer = ATTACK_DURATION;
    s.attackCooldown = ATTACK_COOLDOWN;
    s.vx = 0;
    s.vz = 0;
  }
  const attacking = s.attackTimer > 0;

  // Face the movement direction along the shortest arc.
  if (moveMag > EPSILON) {
    const target = Math.atan2(input.moveX, input.moveZ);
    let diff = target - s.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.facing += diff * Math.min(1, dt * 14);
  }

  // Edge-triggered flight toggle (renderer reports the key going down).
  if (input.toggleFly) {
    s.flying = !s.flying;
    s.landTimer = 0;
    if (s.flying) {
      s.grounded = false;
      if (s.vy < TAKEOFF_LIFT) s.vy = TAKEOFF_LIFT;
    }
  }

  if (s.flying) {
    return updateFlight(s, input, dt, moveMag);
  }

  const targetSpeed = (input.sprint ? RUN_SPEED : WALK_SPEED) * speedScale(input);
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
    } else if (attacking) {
      s.vx = 0;
      s.vz = 0;
      s.action = "attack";
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
    if (attacking) {
      s.vx *= 0.5;
      s.vz *= 0.5;
      s.action = "attack";
    } else if (moveMag > EPSILON) {
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
  if (s.attackTimer > 0) s.action = "attack";
  return s;
}

function updateFlight(
  s: CharacterState,
  input: CharacterInput,
  dt: number,
  moveMag: number,
): CharacterState {
  const targetSpeed = (input.sprint ? FLY_SPRINT_SPEED : FLY_SPEED) * speedScale(input);
  const dirScale = moveMag > 1 ? 1 / moveMag : 1;
  const wantVx = input.moveX * dirScale * targetSpeed;
  const wantVz = input.moveZ * dirScale * targetSpeed;
  const wantVy = input.ascend ? CLIMB_SPEED : input.descend ? -CLIMB_SPEED : 0;
  const k = 1 - Math.exp(-FLY_ACCEL * dt);
  s.vx += (wantVx - s.vx) * k;
  s.vz += (wantVz - s.vz) * k;
  s.vy += (wantVy - s.vy) * k;

  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;

  if (s.y > MAX_ALTITUDE) {
    s.y = MAX_ALTITUDE;
    if (s.vy > 0) s.vy = 0;
  }
  if (s.y < 0) s.y = 0;

  if (s.y <= 0 && s.vy <= 0) {
    const hard = s.vy < -1;
    s.vy = 0;
    s.flying = false;
    s.grounded = true;
    s.vx = 0;
    s.vz = 0;
    s.action = hard ? "land" : "idle";
    s.landTimer = hard ? LAND_RECOVERY : 0;
  } else {
    s.grounded = false;
    s.action = "fly";
  }
  return s;
}
