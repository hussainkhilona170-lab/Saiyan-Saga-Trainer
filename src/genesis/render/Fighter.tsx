import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { advancePhase, createPose, poseForInto, smoothPoseInto, type Pose } from "../sim/animation";
import { updateCharacter, type CharacterInput, type CharacterState } from "../sim/character";
import { LAND_RECOVERY } from "../sim/character";
import type { CharacterDef } from "../characters";
import type { HudStats } from "../hud/GenesisHud";
import type { RawKeys } from "./useKeyboard";
import { moveIntent, resolveCameraPosition } from "./cameraRelative";
import { OBSTACLES } from "../world";

/**
 * Genesis fighter — original low-poly rig driven by the pure character sim,
 * with manual obstacle collision (capsule vs. AABB push-out) and camera
 * collision (ray vs. AABB). Rapier was evaluated (Phase 3) but its Physics
 * provider suspends indefinitely under React 19 in this environment, so the
 * prototype uses the sim's plane ground + manual collision until a compatible
 * Rapier/React pairing is available (see TECH_STACK_DECISIONS.md §7 reversal
 * trigger).
 */
const CAM_BACK = 5;
const CAM_UP = 2.2;
const LOOK_AT_Y = 1.15;
const CHAR_RADIUS = 0.4;

type FighterProps = {
  stateRef: RefObject<CharacterState>;
  keysRef: RefObject<RawKeys>;
  onStats: (s: HudStats) => void;
  character: CharacterDef;
  teleportRef?: RefObject<{ x: number; y: number; z: number } | null>;
};

export function Fighter({ stateRef, keysRef, onStats, character, teleportRef }: FighterProps) {
  const { camera } = useThree();

  const innerRef = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const aura = useRef<THREE.Mesh>(null);
  const shoulderL = useRef<THREE.Group>(null);
  const shoulderR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);

  const anim = useRef({ phase: 0, current: createPose(), target: createPose() });
  const frames = useRef({ count: 0, time: 0 });
  const wasGroundedRef = useRef(true);

  useFrame((_, delta) => {
    const tp = teleportRef?.current;
    if (tp) {
      stateRef.current = { ...stateRef.current, x: tp.x, y: tp.y, z: tp.z, vx: 0, vy: 0, vz: 0 };
      teleportRef.current = null;
    }

    const keys = keysRef.current;
    const move = moveIntent(keys, camera);
    const input: CharacterInput = {
      moveX: move.moveX,
      moveZ: move.moveZ,
      sprint: keys.sprint,
      jump: keys.jump,
    };
    const next = updateCharacter(stateRef.current, input, delta);
    const speed = Math.hypot(next.vx, next.vz);

    // --- manual obstacle collision (capsule ≈ circle in XZ) ---------------
    let rx = next.x;
    let rz = next.z;
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      for (const ob of OBSTACLES) {
        const halfW = ob.w / 2;
        const halfD = ob.d / 2;
        const cx = Math.max(ob.x - halfW, Math.min(rx, ob.x + halfW));
        const cz = Math.max(ob.z - halfD, Math.min(rz, ob.z + halfD));
        const dx = rx - cx;
        const dz = rz - cz;
        const dist = Math.hypot(dx, dz);
        if (dist < CHAR_RADIUS && dist > 1e-6) {
          const push = (CHAR_RADIUS - dist) / dist;
          rx += dx * push;
          rz += dz * push;
          pushed = true;
        } else if (dist <= 1e-6) {
          // Inside the box: push out along the shortest axis.
          const toLeft = rx - (ob.x - halfW);
          const toRight = ob.x + halfW - rx;
          const toBack = rz - (ob.z - halfD);
          const toFront = ob.z + halfD - rz;
          const min = Math.min(toLeft, toRight, toBack, toFront);
          if (min === toLeft) rx = ob.x - halfW - CHAR_RADIUS;
          else if (min === toRight) rx = ob.x + halfW + CHAR_RADIUS;
          else if (min === toBack) rz = ob.z - halfD - CHAR_RADIUS;
          else rz = ob.z + halfD + CHAR_RADIUS;
          pushed = true;
        }
      }
      if (!pushed) break;
    }

    // Landing detection off the sim's own ground flag (plane ground).
    let action = next.action;
    let landTimer = next.landTimer;
    let vy = next.vy;
    const grounded = next.grounded;
    if (grounded && !wasGroundedRef.current) {
      action = "land";
      landTimer = LAND_RECOVERY;
      vy = 0;
    }
    if (grounded && vy < 0) vy = 0;
    wasGroundedRef.current = grounded;

    const resolved = { x: rx, y: next.y, z: rz };
    stateRef.current = {
      ...next,
      x: resolved.x,
      y: resolved.y,
      z: resolved.z,
      action,
      landTimer,
      vy,
      grounded,
    };

    if (innerRef.current) {
      innerRef.current.position.set(resolved.x, resolved.y, resolved.z);
      innerRef.current.rotation.y = next.facing;
    }

    // Pose.
    const a = anim.current;
    a.phase = advancePhase(a.phase, action, speed, delta);
    poseForInto(a.target, action, speed, a.phase);
    smoothPoseInto(a.current, a.current, a.target, 1 - Math.exp(-delta * 16));
    const pose: Pose = a.current;

    if (hips.current) hips.current.position.y = 0.85 + pose.hipsY;
    if (torso.current) {
      torso.current.rotation.x = -pose.torsoPitch;
      torso.current.rotation.z = pose.torsoRoll;
    }
    if (head.current) head.current.rotation.y = pose.headYaw;
    if (shoulderL.current) shoulderL.current.rotation.set(-pose.shoulderL, 0, -pose.armSpread);
    if (shoulderR.current) shoulderR.current.rotation.set(-pose.shoulderR, 0, pose.armSpread);
    if (elbowL.current) elbowL.current.rotation.x = -pose.elbowL;
    if (elbowR.current) elbowR.current.rotation.x = -pose.elbowR;
    if (hipL.current) hipL.current.rotation.x = -pose.hipL;
    if (hipR.current) hipR.current.rotation.x = -pose.hipR;
    if (kneeL.current) kneeL.current.rotation.x = pose.kneeL;
    if (kneeR.current) kneeR.current.rotation.x = pose.kneeR;

    if (aura.current) {
      const t = Math.min(1, speed / 8);
      const mat = aura.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + 0.34 * t;
      const s = (1 + 0.12 * t) * character.scale;
      aura.current.scale.set(s, 1, s);
      aura.current.rotation.z += delta * (0.6 + 2.4 * t);
    }

    // Camera with collision (ray vs. obstacle AABBs).
    const desiredCam = { x: resolved.x, y: resolved.y + CAM_UP, z: resolved.z + CAM_BACK };
    const lookAt = { x: resolved.x, y: resolved.y + LOOK_AT_Y, z: resolved.z };
    const dx2 = desiredCam.x - lookAt.x;
    const dy2 = desiredCam.y - lookAt.y;
    const dz2 = desiredCam.z - lookAt.z;
    const dist = Math.hypot(dx2, dy2, dz2);
    let hitToi: number | null = null;
    if (dist > 0) {
      const dir = { x: dx2 / dist, y: dy2 / dist, z: dz2 / dist };
      let best = Infinity;
      for (const ob of OBSTACLES) {
        const t = rayAABB(lookAt, dir, {
          min: { x: ob.x - ob.w / 2, y: -Infinity, z: ob.z - ob.d / 2 },
          max: { x: ob.x + ob.w / 2, y: Infinity, z: ob.z + ob.d / 2 },
        });
        if (t !== null && t < best) best = t;
      }
      if (best !== Infinity && best < dist) hitToi = best / dist;
    }
    const camPos = resolveCameraPosition(lookAt, desiredCam, hitToi, 0.82);
    const camTarget = new THREE.Vector3(camPos.x, camPos.y, camPos.z);
    camera.position.lerp(camTarget, 1 - Math.exp(-delta * 6));
    camera.lookAt(lookAt.x, lookAt.y, lookAt.z);

    // Stats.
    const acc = frames.current;
    acc.count += 1;
    acc.time += delta;
    if (acc.time >= 0.5) {
      onStats({
        fps: Math.round(acc.count / acc.time),
        ms: (acc.time / acc.count) * 1000,
        action,
        speed,
        character: character.name,
      });
      acc.count = 0;
      acc.time = 0;
    }
  });

  const s = character.scale;
  const gi = character.gi;
  const under = character.under;
  const hair = character.hair;
  const skin = character.skin;

  return (
    <group ref={innerRef}>
      <mesh ref={aura} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.78, 32]} />
        <meshBasicMaterial
          color={gi}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group position={[0, 0.85, 0]} ref={hips}>
        <mesh position={[0, -0.01, 0]} castShadow>
          <boxGeometry args={[0.3, 0.17, 0.22]} />
          <meshStandardMaterial color="#28324d" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.09, 0]} castShadow>
          <boxGeometry args={[0.33, 0.08, 0.25]} />
          <meshStandardMaterial color="#1b2338" roughness={0.7} />
        </mesh>

        <group ref={torso}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.44, 0.46, 0.26]} />
            <meshStandardMaterial
              color={gi}
              roughness={0.6}
              emissive={gi}
              emissiveIntensity={0.12}
            />
          </mesh>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.4, 0.12, 0.27]} />
            <meshStandardMaterial color={under} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[0.12, 0.08, 0.12]} />
            <meshStandardMaterial color={skin} roughness={0.9} />
          </mesh>

          <group ref={head} position={[0, 0.74, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.145 * s, 20, 16]} />
              <meshStandardMaterial color={skin} roughness={0.85} />
            </mesh>
            <mesh position={[-0.055, 0.02, 0.125]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial color="#1b1b1b" roughness={0.4} />
            </mesh>
            <mesh position={[0.055, 0.02, 0.125]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial color="#1b1b1b" roughness={0.4} />
            </mesh>
            {[
              { p: [0, 0.3, 0.02], r: [0.12, 0, 0] },
              { p: [-0.075, 0.27, 0.01], r: [0, 0, 0.4] },
              { p: [0.075, 0.27, 0.01], r: [0, 0, -0.4] },
              { p: [0, 0.27, -0.09], r: [-0.35, 0, 0] },
              { p: [-0.06, 0.25, -0.07], r: [-0.25, 0, 0.28] },
              { p: [0.06, 0.25, -0.07], r: [-0.25, 0, -0.28] },
            ].map((spike, i) => (
              <mesh
                key={i}
                position={spike.p as [number, number, number]}
                rotation={spike.r as [number, number, number]}
                castShadow
              >
                <coneGeometry args={[0.055, 0.24, 6]} />
                <meshStandardMaterial color={hair} roughness={0.75} />
              </mesh>
            ))}
          </group>

          <group ref={shoulderL} position={[-0.26, 0.46, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.18, 4, 10]} />
              <meshStandardMaterial color={gi} roughness={0.65} />
            </mesh>
            <group ref={elbowL} position={[0, -0.26, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.16, 4, 10]} />
                <meshStandardMaterial color={skin} roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow>
                <sphereGeometry args={[0.062, 12, 12]} />
                <meshStandardMaterial color={under} roughness={0.7} />
              </mesh>
            </group>
          </group>
          <group ref={shoulderR} position={[0.26, 0.46, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.18, 4, 10]} />
              <meshStandardMaterial color={gi} roughness={0.65} />
            </mesh>
            <group ref={elbowR} position={[0, -0.26, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.16, 4, 10]} />
                <meshStandardMaterial color={skin} roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow>
                <sphereGeometry args={[0.062, 12, 12]} />
                <meshStandardMaterial color={under} roughness={0.7} />
              </mesh>
            </group>
          </group>
        </group>

        <group ref={hipL} position={[-0.11, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.078, 0.24, 4, 10]} />
            <meshStandardMaterial color="#28324d" roughness={0.85} />
          </mesh>
          <group ref={kneeL} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.066, 0.2, 4, 10]} />
              <meshStandardMaterial color="#28324d" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.37, 0.03]} castShadow>
              <boxGeometry args={[0.14, 0.12, 0.24]} />
              <meshStandardMaterial color="#1f2a42" roughness={0.6} />
            </mesh>
          </group>
        </group>
        <group ref={hipR} position={[0.11, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.078, 0.24, 4, 10]} />
            <meshStandardMaterial color="#28324d" roughness={0.85} />
          </mesh>
          <group ref={kneeR} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.066, 0.2, 4, 10]} />
              <meshStandardMaterial color="#28324d" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.37, 0.03]} castShadow>
              <boxGeometry args={[0.14, 0.12, 0.24]} />
              <meshStandardMaterial color="#1f2a42" roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Slab (ray vs. AABB) intersection. Returns distance along the ray, or null. */
function rayAABB(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes: Array<"x" | "y" | "z"> = ["x", "y", "z"];
  for (const axis of axes) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}
