import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";
import { advancePhase, createPose, poseForInto, smoothPoseInto, type Pose } from "../sim/animation";
import { updateCharacter, type CharacterInput, type CharacterState } from "../sim/character";
import { LAND_RECOVERY } from "../sim/character";
import type { CharacterDef } from "../characters";
import type { HudStats } from "../hud/GenesisHud";
import type { RawKeys } from "./useKeyboard";
import { moveIntent, resolveCameraPosition } from "./cameraRelative";

/**
 * Genesis fighter — original low-poly rig, now driven by Rapier physics:
 * a kinematic character controller resolves movement against the ground and
 * obstacle colliders, so the player slides along walls and snaps to the floor
 * instead of clipping through geometry. Camera collision pulls the follow cam
 * in when geometry occludes the view.
 */
const CAM_BACK = 5;
const CAM_UP = 2.2;
const LOOK_AT_Y = 1.15;

type FighterProps = {
  stateRef: RefObject<CharacterState>;
  keysRef: RefObject<RawKeys>;
  onStats: (s: HudStats) => void;
  character: CharacterDef;
};

export function Fighter({ stateRef, keysRef, onStats, character }: FighterProps) {
  const { camera } = useThree();
  const { world, rapier } = useRapier();

  const rbRef = useRef<RapierRigidBody>(null);
  const innerRef = useRef<THREE.Group>(null);
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const resolvedRef = useRef({ x: 0, y: 0, z: 0 });
  const wasGroundedRef = useRef(true);

  // Joint refs.
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

  // Create the character controller once per physics world.
  useEffect(() => {
    const ctrl = world.createCharacterController(0.01);
    ctrl.enableAutostep(0.35, 0.3, true);
    ctrl.enableSnapToGround(0.3);
    ctrl.setMaxSlopeClimbAngle(Math.PI / 3);
    ctrl.setSlideEnabled(true);
    controllerRef.current = ctrl;
    return () => {
      ctrl.free();
      controllerRef.current = null;
    };
  }, [world]);

  // Sync resolved position to the rigid body on mount (character starts at origin).
  useEffect(() => {
    resolvedRef.current = { x: 0, y: 0, z: 0 };
  }, []);

  useFrame((_, delta) => {
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

    // Desired translation from the sim's integrated position (sim starts from
    // the last resolved position, so this is exactly velocity * dt).
    const desired = {
      x: next.x - resolvedRef.current.x,
      y: next.y - resolvedRef.current.y,
      z: next.z - resolvedRef.current.z,
    };

    const ctrl = controllerRef.current;
    const rb = rbRef.current;
    let resolvedX = resolvedRef.current.x;
    let resolvedY = resolvedRef.current.y;
    let resolvedZ = resolvedRef.current.z;
    let grounded = next.grounded;

    if (ctrl && rb) {
      const collider = rb.collider(0);
      if (collider) {
        ctrl.computeColliderMovement(collider, desired);
        const m = ctrl.computedMovement();
        resolvedX += m.x;
        resolvedY += m.y;
        resolvedZ += m.z;
        grounded = ctrl.computedGrounded();
      }
    } else {
      resolvedX = next.x;
      resolvedY = next.y;
      resolvedZ = next.z;
    }

    // Landing detection off the physics result.
    let action = next.action;
    let landTimer = next.landTimer;
    let vy = next.vy;
    if (grounded && !wasGroundedRef.current) {
      action = "land";
      landTimer = LAND_RECOVERY;
      vy = 0;
    }
    if (grounded && vy < 0) vy = 0;
    wasGroundedRef.current = grounded;

    resolvedRef.current.x = resolvedX;
    resolvedRef.current.y = resolvedY;
    resolvedRef.current.z = resolvedZ;

    if (rb) rb.setTranslation({ x: resolvedX, y: resolvedY, z: resolvedZ }, true);
    if (innerRef.current) innerRef.current.rotation.y = next.facing;

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

    // Camera with collision.
    const desiredCam = {
      x: resolvedX,
      y: resolvedY + CAM_UP,
      z: resolvedZ + CAM_BACK,
    };
    const lookAt = { x: resolvedX, y: resolvedY + LOOK_AT_Y, z: resolvedZ };
    const dx2 = desiredCam.x - lookAt.x;
    const dy2 = desiredCam.y - lookAt.y;
    const dz2 = desiredCam.z - lookAt.z;
    const dist = Math.hypot(dx2, dy2, dz2);
    let hitToi: number | null = null;
    if (dist > 0 && world) {
      const ray = new rapier.Ray(
        new rapier.Vector3(lookAt.x, lookAt.y, lookAt.z),
        new rapier.Vector3(dx2 / dist, dy2 / dist, dz2 / dist),
      );
      const exclude = rb ? rb.collider(0) : undefined;
      const hit = world.castRay(ray, dist, true, undefined, undefined, exclude);
      if (hit) hitToi = hit.timeOfImpact / dist;
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

    stateRef.current = {
      ...next,
      x: resolvedX,
      y: resolvedY,
      z: resolvedZ,
      grounded,
      action,
      landTimer,
      vy,
    };
  });

  const s = character.scale;
  const gi = character.gi;
  const under = character.under;
  const hair = character.hair;
  const skin = character.skin;

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders={false} position={[0, 0, 0]}>
      <CapsuleCollider args={[0.32, 0.45]} position={[0, 0.78, 0]} />
      <group ref={innerRef}>
        {/* Ki aura on the ground plane. */}
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

        <group ref={hips}>
          {/* Pelvis + belt */}
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
    </RigidBody>
  );
}
