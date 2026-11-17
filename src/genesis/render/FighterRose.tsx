/**
 * Rose Saiyan fighter — drives an original GLB rig (rose_saiyan.glb) with the
 * pure animation Pose state machine. Bones are rotated each frame from the
 * same angles that drive the procedural fighter, so walk/run/jump/limb motion
 * works without baked clips. Original character — no copyrighted assets.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { advancePhase, createPose, poseForInto, smoothPoseInto, type Pose } from "../sim/animation";
import { updateCharacter, type CharacterInput, type CharacterState } from "../sim/character";
import { LAND_RECOVERY } from "../sim/character";
import type { CharacterDef } from "../characters";
import type { HudStats } from "../hud/GenesisHud";
import type { RawKeys } from "./useKeyboard";
import { moveIntent, resolveCameraPosition } from "./cameraRelative";
import { resolveBones } from "./boneNames";
import { OBSTACLES } from "../world";

const CAM_BACK = 3.6;
const CAM_UP = 1.9;
const LOOK_AT_Y = 1.0;
const CHAR_RADIUS = 0.4;

type FighterProps = {
  stateRef: RefObject<CharacterState>;
  keysRef: RefObject<RawKeys>;
  onStats: (s: HudStats) => void;
  character: CharacterDef;
  teleportRef?: RefObject<{ x: number; y: number; z: number } | null>;
  modelUrl: string;
};

type Bones = {
  root: THREE.Bone;
  hips: THREE.Bone;
  spine: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  upperArmL: THREE.Bone;
  lowerArmL: THREE.Bone;
  upperArmR: THREE.Bone;
  lowerArmR: THREE.Bone;
  thighL: THREE.Bone;
  shinL: THREE.Bone;
  thighR: THREE.Bone;
  shinR: THREE.Bone;
};

export function FighterRose({
  stateRef,
  keysRef,
  onStats,
  character,
  teleportRef,
  modelUrl,
}: FighterProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<Bones | null>(null);
  const [loaded, setLoaded] = useState(false);
  const auraRef = useRef<THREE.Mesh>(null);

  const anim = useRef({ phase: 0, current: createPose(), target: createPose() });
  const frames = useRef({ count: 0, time: 0 });
  const wasGroundedRef = useRef(true);
  // Rest rotations captured at load so we can offset from the bind pose.
  const restRef = useRef<Record<string, THREE.Euler> | null>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    let cancelled = false;
    fetch(modelUrl)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const loader = new GLTFLoader();
        loader.parse(
          buf,
          "",
          (gltf) => {
            if (cancelled) return;
            const scene = gltf.scene;
            group.add(scene);
            let skinned: THREE.SkinnedMesh | null = null;
            scene.traverse((o) => {
              if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = o as THREE.SkinnedMesh;
            });
            const skeleton = skinned ? (skinned as THREE.SkinnedMesh).skeleton : null;
            // three.js sanitises node names on load (dots are stripped), so match
            // on the normalised name instead of the authored one.
            const available: string[] = skeleton
              ? skeleton.bones.map((b) => b.name)
              : (() => {
                  const names: string[] = [];
                  scene.traverse((o) => {
                    if ((o as THREE.Bone).isBone) names.push(o.name);
                  });
                  return names;
                })();
            const resolved = resolveBones(available, {
              root: "root",
              hips: "hips",
              spine: "spine",
              chest: "chest",
              neck: "neck",
              head: "head",
              upperArmL: "upperArm.L",
              lowerArmL: "lowerArm.L",
              upperArmR: "upperArm.R",
              lowerArmR: "lowerArm.R",
              thighL: "thigh.L",
              shinL: "shin.L",
              thighR: "thigh.R",
              shinR: "shin.R",
            });
            const bones: Bones | null = resolved
              ? (Object.fromEntries(
                  Object.entries(resolved).map(([key, name]) => [
                    key,
                    skeleton
                      ? (skeleton.bones.find((b) => b.name === name) ?? null)
                      : (() => {
                          let hit: THREE.Bone | null = null;
                          scene.traverse((o) => {
                            if (o.name === name && (o as THREE.Bone).isBone) hit = o as THREE.Bone;
                          });
                          return hit;
                        })(),
                  ]),
                ) as Bones)
              : null;
            if (!bones) {
              console.warn(
                "FighterRose: rig bones not found in",
                modelUrl,
                "- available:",
                available.slice(0, 24),
              );
            }
            bonesRef.current = bones;
            const rest: Record<string, THREE.Euler> = {};
            if (bones) {
              for (const [k, v] of Object.entries(bones)) {
                rest[k] = { x: v.rotation.x, y: v.rotation.y, z: v.rotation.z } as THREE.Euler;
              }
            }
            restRef.current = rest;
            setLoaded(true);
          },
          (err) => console.error("Rose GLTF parse error:", err),
        );
      })
      .catch((err) => console.error("Rose GLTF fetch error:", err));
    return () => {
      cancelled = true;
      while (group.children.length > 0) {
        const c = group.children[0];
        if (c) group.remove(c);
        else break;
      }
    };
  }, [modelUrl]);

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

    // collision
    let rx = next.x,
      rz = next.z;
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      for (const ob of OBSTACLES) {
        const hw = ob.w / 2,
          hd = ob.d / 2;
        const cx = Math.max(ob.x - hw, Math.min(rx, ob.x + hw));
        const cz = Math.max(ob.z - hd, Math.min(rz, ob.z + hd));
        const dx = rx - cx,
          dz = rz - cz,
          dist = Math.hypot(dx, dz);
        if (dist < CHAR_RADIUS && dist > 1e-6) {
          const p = (CHAR_RADIUS - dist) / dist;
          rx += dx * p;
          rz += dz * p;
          pushed = true;
        } else if (dist <= 1e-6) {
          const l = rx - (ob.x - hw),
            r = ob.x + hw - rx,
            b = rz - (ob.z - hd),
            f = ob.z + hd - rz;
          const m = Math.min(l, r, b, f);
          if (m === l) rx = ob.x - hw - CHAR_RADIUS;
          else if (m === r) rx = ob.x + hw + CHAR_RADIUS;
          else if (m === b) rz = ob.z - hd - CHAR_RADIUS;
          else rz = ob.z + hd + CHAR_RADIUS;
          pushed = true;
        }
      }
      if (!pushed) break;
    }

    let action = next.action,
      landTimer = next.landTimer,
      vy = next.vy;
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

    if (groupRef.current) {
      groupRef.current.position.set(resolved.x, resolved.y, resolved.z);
      groupRef.current.rotation.y = next.facing;
    }

    // Pose from the pure animation system.
    const a = anim.current;
    a.phase = advancePhase(a.phase, action, speed, delta);
    poseForInto(a.target, action, speed, a.phase);
    smoothPoseInto(a.current, a.current, a.target, 1 - Math.exp(-delta * 16));
    const pose: Pose = a.current;

    const bones = bonesRef.current;
    const rest = restRef.current;
    if (bones && rest) {
      const set = (key: keyof Bones, x: number, y = 0, z = 0) => {
        const b = bones[key];
        const r = rest[key];
        if (!b || !r) return;
        b.rotation.set(r.x + x, r.y + y, r.z + z);
      };
      // Legs swing opposite; knees only bend forward.
      set("thighL", -pose.hipL, 0, 0);
      set("thighR", -pose.hipR, 0, 0);
      set("shinL", pose.kneeL, 0, 0);
      set("shinR", pose.kneeR, 0, 0);
      // Arms counter-swing; elbows bend.
      set("upperArmL", -pose.shoulderL, 0, -pose.armSpread);
      set("upperArmR", -pose.shoulderR, 0, pose.armSpread);
      set("lowerArmL", -pose.elbowL, 0, 0);
      set("lowerArmR", -pose.elbowR, 0, 0);
      // Torso lean/roll, head yaw, hips bob.
      set("spine", -pose.torsoPitch, 0, pose.torsoRoll);
      set("chest", -pose.torsoPitch * 0.5, 0, 0);
      set("head", 0, pose.headYaw, 0);
      // Root vertical bob (whole rig).
      bones.root.position.y = pose.hipsY;
    }

    // Aura pulses with speed.
    if (auraRef.current) {
      const t = Math.min(1, speed / 8);
      const mat = auraRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + 0.4 * t;
      const s = 1 + 0.15 * t;
      auraRef.current.scale.set(s, 1, s);
      auraRef.current.rotation.z += delta * (0.8 + 3 * t);
    }

    // Camera
    const desiredCam = { x: resolved.x, y: resolved.y + CAM_UP, z: resolved.z + CAM_BACK };
    const lookAt = { x: resolved.x, y: resolved.y + LOOK_AT_Y, z: resolved.z };
    const dx2 = desiredCam.x - lookAt.x,
      dy2 = desiredCam.y - lookAt.y,
      dz2 = desiredCam.z - lookAt.z;
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

  return (
    <group ref={groupRef}>
      <mesh ref={auraRef} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.9, 40]} />
        <meshBasicMaterial
          color="#e0508c"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {!loaded && (
        <mesh position={[0, 0.9, 0]}>
          <capsuleGeometry args={[0.3, 0.7, 8, 12]} />
          <meshStandardMaterial color="#232a4a" />
        </mesh>
      )}
    </group>
  );
}

function rayAABB(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
): number | null {
  let tmin = -Infinity,
    tmax = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis],
      d = dir[axis],
      lo = box.min[axis],
      hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d,
        t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}
