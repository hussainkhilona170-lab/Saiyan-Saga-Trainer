import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
  modelUrl: string;
};

function findClip(clips: THREE.AnimationClip[], ...patterns: string[]): THREE.AnimationClip | null {
  for (const pat of patterns) {
    const lower = pat.toLowerCase();
    const found = clips.find((c) => c.name.toLowerCase().includes(lower));
    if (found) return found;
  }
  return null;
}

export function FighterGLTF({
  stateRef,
  keysRef,
  onStats,
  character,
  teleportRef,
  modelUrl,
}: FighterProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction | null>>({});
  const currentActionRef = useRef<string>("idle");
  const [loaded, setLoaded] = useState(false);

  const anim = useRef({ phase: 0 });
  const frames = useRef({ count: 0, time: 0 });
  const wasGroundedRef = useRef(true);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

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
            const scene = gltf.scene;
            scene.scale.set(1, 1, 1);
            group.add(scene);
            const mixer = new THREE.AnimationMixer(scene);
            mixerRef.current = mixer;
            const clips = gltf.animations;
            const idleClip = findClip(clips, "idle", "stand", "breath");
            const walkClip = findClip(clips, "walk", "walking");
            const runClip = findClip(clips, "run", "running", "sprint");
            const jumpClip = findClip(clips, "jump", "jumping");
            const fallClip = findClip(clips, "fall", "falling");
            const landClip = findClip(clips, "land", "landing");
            actionsRef.current = {
              idle: idleClip ? mixer.clipAction(idleClip) : null,
              walk: walkClip ? mixer.clipAction(walkClip) : null,
              run: runClip ? mixer.clipAction(runClip) : null,
              jump: jumpClip ? mixer.clipAction(jumpClip) : null,
              fall: fallClip ? mixer.clipAction(fallClip) : null,
              land: landClip ? mixer.clipAction(landClip) : null,
            };
            if (actionsRef.current["idle"]) {
              actionsRef.current["idle"]!.play();
              currentActionRef.current = "idle";
            }
            setLoaded(true);
          },
          (err) => {
            console.error("GLTF parse error:", err);
          },
        );
      })
      .catch((err) => {
        console.error("GLTF fetch error:", err);
      });

    return () => {
      if (mixerRef.current) mixerRef.current.stopAllAction();
      while (group.children.length > 0) {
        const child = group.children[0];
        if (child) group.remove(child);
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

    if (groupRef.current) {
      groupRef.current.position.set(resolved.x, resolved.y, resolved.z);
      groupRef.current.rotation.y = next.facing;
    }

    if (loaded && action !== currentActionRef.current) {
      const prev = actionsRef.current[currentActionRef.current];
      const nextAct = actionsRef.current[action];
      if (prev) prev.fadeOut(0.15);
      if (nextAct) {
        nextAct.reset().fadeIn(0.15).play();
        if (action === "jump" || action === "land") {
          nextAct.setLoop(THREE.LoopOnce, 1);
          nextAct.clampWhenFinished = true;
        } else {
          nextAct.setLoop(THREE.LoopRepeat, Infinity);
        }
      }
      currentActionRef.current = action;
    }

    if (mixerRef.current) mixerRef.current.update(delta);

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

  return (
    <>
      {!loaded && (
        <mesh position={[0, 1, 0]}>
          <capsuleGeometry args={[0.3, 0.8, 8, 12]} />
          <meshStandardMaterial color={character.gi} />
        </mesh>
      )}
      <group ref={groupRef} />
    </>
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
