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

// Toon gradient texture for cel-shaded DBZ look
function makeToonGradient(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#404040";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = "#808080";
  ctx.fillRect(1, 0, 1, 1);
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(2, 0, 1, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(3, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

let _toonGrad: THREE.CanvasTexture | null = null;
function toonGrad(): THREE.CanvasTexture {
  if (!_toonGrad) _toonGrad = makeToonGradient();
  return _toonGrad;
}

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

  const grad = toonGrad();

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
      mat.opacity = 0.12 + 0.3 * t;
      const s = (1 + 0.1 * t) * character.scale;
      aura.current.scale.set(s, 1, s);
      aura.current.rotation.z += delta * (0.6 + 2.4 * t);
    }

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

  // Toon materials
  const toonMat = (color: string, emissive?: string, ei = 0) => (
    <meshToonMaterial
      color={color}
      gradientMap={grad}
      emissive={emissive || color}
      emissiveIntensity={ei}
    />
  );

  return (
    <group ref={innerRef}>
      {/* Ki aura */}
      <mesh ref={aura} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.85, 32]} />
        <meshBasicMaterial
          color={gi}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group position={[0, 0, 0]} ref={hips}>
        {/* Pelvis */}
        <mesh position={[0, -0.02, 0]} castShadow>
          <capsuleGeometry args={[0.16, 0.12, 8, 12]} />
          {toonMat("#28324d")}
        </mesh>
        {/* Belt */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.36, 0.09, 0.26]} />
          {toonMat("#1b2338")}
        </mesh>
        {/* Belt knot */}
        <mesh position={[0, 0.1, 0.16]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.06]} />
          {toonMat("#1b2338")}
        </mesh>

        <group ref={torso}>
          {/* Gi top - main body */}
          <mesh position={[0, 0.28, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.3, 8, 12]} />
            {toonMat(gi, gi, 0.05)}
          </mesh>
          {/* Blue undershirt visible at collar */}
          <mesh position={[0, 0.48, 0.02]} castShadow>
            <boxGeometry args={[0.3, 0.12, 0.2]} />
            {toonMat(under)}
          </mesh>
          {/* Gi wrap / sash */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.42, 0.1, 0.28]} />
            {toonMat(gi, gi, 0.03)}
          </mesh>
          {/* Neck */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.08, 6, 10]} />
            {toonMat(skin)}
          </mesh>

          {/* Head */}
          <group ref={head} position={[0, 0.72, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.16 * s, 24, 16]} />
              {toonMat(skin)}
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.06, 0.02, 0.13]}>
              <sphereGeometry args={[0.03, 10, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0.06, 0.02, 0.13]}>
              <sphereGeometry args={[0.03, 10, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            {/* Pupils */}
            <mesh position={[-0.055, 0.02, 0.155]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.2} />
            </mesh>
            <mesh position={[0.055, 0.02, 0.155]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.2} />
            </mesh>
            {/* Eyebrows */}
            <mesh position={[-0.06, 0.06, 0.14]} rotation={[0, 0, -0.15]}>
              <boxGeometry args={[0.06, 0.012, 0.02]} />
              {toonMat(hair)}
            </mesh>
            <mesh position={[0.06, 0.06, 0.14]} rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.06, 0.012, 0.02]} />
              {toonMat(hair)}
            </mesh>
            {/* Nose */}
            <mesh position={[0, -0.01, 0.15]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              {toonMat(skin)}
            </mesh>
            {/* Mouth */}
            <mesh position={[0, -0.05, 0.14]}>
              <boxGeometry args={[0.05, 0.008, 0.01]} />
              <meshStandardMaterial color="#8b4a3a" roughness={0.8} />
            </mesh>

            {/* Spiky Saiyan hair */}
            {[
              {
                p: [0, 0.22, 0.02] as [number, number, number],
                r: [0.0, 0, 0] as [number, number, number],
                s: 1.0,
              },
              {
                p: [-0.06, 0.2, 0.0] as [number, number, number],
                r: [0.1, 0, 0.35] as [number, number, number],
                s: 0.9,
              },
              {
                p: [0.06, 0.2, 0.0] as [number, number, number],
                r: [0.1, 0, -0.35] as [number, number, number],
                s: 0.9,
              },
              {
                p: [-0.1, 0.16, -0.04] as [number, number, number],
                r: [-0.2, 0, 0.5] as [number, number, number],
                s: 0.8,
              },
              {
                p: [0.1, 0.16, -0.04] as [number, number, number],
                r: [-0.2, 0, -0.5] as [number, number, number],
                s: 0.8,
              },
              {
                p: [0, 0.18, -0.1] as [number, number, number],
                r: [-0.4, 0, 0] as [number, number, number],
                s: 0.85,
              },
              {
                p: [-0.04, 0.2, 0.1] as [number, number, number],
                r: [0.2, 0, 0.2] as [number, number, number],
                s: 0.7,
              },
              {
                p: [0.04, 0.2, 0.1] as [number, number, number],
                r: [0.2, 0, -0.2] as [number, number, number],
                s: 0.7,
              },
              {
                p: [0, 0.14, 0.12] as [number, number, number],
                r: [0.5, 0, 0] as [number, number, number],
                s: 0.6,
              },
            ].map((spike, i) => (
              <mesh key={i} position={spike.p} rotation={spike.r} castShadow>
                <coneGeometry args={[0.05 * spike.s, 0.28 * spike.s, 6]} />
                {toonMat(hair)}
              </mesh>
            ))}
            {/* Hair base */}
            <mesh position={[0, 0.14, -0.02]} castShadow>
              <sphereGeometry args={[0.16 * s, 12, 10]} />
              {toonMat(hair)}
            </mesh>
          </group>

          {/* Arms */}
          <group ref={shoulderL} position={[-0.25, 0.44, 0]}>
            {/* Wristband */}
            <mesh position={[0, -0.42, 0]} castShadow>
              <cylinderGeometry args={[0.065, 0.065, 0.06, 10]} />
              {toonMat(under)}
            </mesh>
            {/* Upper arm */}
            <mesh position={[0, -0.12, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.16, 8, 10]} />
              {toonMat(gi)}
            </mesh>
            <group ref={elbowL} position={[0, -0.26, 0]}>
              {/* Forearm */}
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.14, 8, 10]} />
                {toonMat(skin)}
              </mesh>
              {/* Fist */}
              <mesh position={[0, -0.24, 0]} castShadow>
                <sphereGeometry args={[0.065, 10, 10]} />
                {toonMat(skin)}
              </mesh>
            </group>
          </group>
          <group ref={shoulderR} position={[0.25, 0.44, 0]}>
            <mesh position={[0, -0.42, 0]} castShadow>
              <cylinderGeometry args={[0.065, 0.065, 0.06, 10]} />
              {toonMat(under)}
            </mesh>
            <mesh position={[0, -0.12, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.16, 8, 10]} />
              {toonMat(gi)}
            </mesh>
            <group ref={elbowR} position={[0, -0.26, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.14, 8, 10]} />
                {toonMat(skin)}
              </mesh>
              <mesh position={[0, -0.24, 0]} castShadow>
                <sphereGeometry args={[0.065, 10, 10]} />
                {toonMat(skin)}
              </mesh>
            </group>
          </group>
        </group>

        {/* Legs */}
        <group ref={hipL} position={[-0.12, 0, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.22, 8, 10]} />
            {toonMat("#28324d")}
          </mesh>
          <group ref={kneeL} position={[0, -0.42, 0]}>
            {/* Shin */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.18, 8, 10]} />
              {toonMat("#28324d")}
            </mesh>
            {/* Boot */}
            <mesh position={[0, -0.36, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.14, 0.24]} />
              {toonMat("#1f2a42")}
            </mesh>
            {/* Boot sole */}
            <mesh position={[0, -0.43, 0.06]} castShadow>
              <boxGeometry args={[0.14, 0.04, 0.26]} />
              {toonMat("#111827")}
            </mesh>
          </group>
        </group>
        <group ref={hipR} position={[0.12, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.22, 8, 10]} />
            {toonMat("#28324d")}
          </mesh>
          <group ref={kneeR} position={[0, -0.42, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.18, 8, 10]} />
              {toonMat("#28324d")}
            </mesh>
            <mesh position={[0, -0.36, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.14, 0.24]} />
              {toonMat("#1f2a42")}
            </mesh>
            <mesh position={[0, -0.43, 0.06]} castShadow>
              <boxGeometry args={[0.14, 0.04, 0.26]} />
              {toonMat("#111827")}
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

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
