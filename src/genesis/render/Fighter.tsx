import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { advancePhase, createPose, poseForInto, smoothPoseInto, type Pose } from "../sim/animation";
import { updateCharacter, type CharacterInput, type CharacterState } from "../sim/character";
import type { HudStats } from "../hud/GenesisHud";
import { moveIntent } from "./cameraRelative";
import type { RawKeys } from "./useKeyboard";

/**
 * Genesis fighter — an original low-poly body built from primitives so the
 * prototype needs no licensed assets. Every limb is a nested group: the joint
 * pivot is the group origin, so the pure pose angles map onto rotations 1:1.
 *
 * Local +Z is the fighter's forward direction (matches the sim's facing math).
 */
const HIP_REST_Y = 0.85;
const CAM_BACK = 5;
const CAM_UP = 2.2;
const LOOK_AT_Y = 1.15;

/** Palette follows the app's oklch tokens (hex approximations for 3D materials). */
const BODY = {
  gi: "#f5a54a", // --primary oklch(0.75 0.18 55)
  giDark: "#c07c2c",
  under: "#2f6fa8",
  pants: "#28324d",
  belt: "#1b2338",
  boot: "#1f2a42",
  skin: "#ffd9a8",
  hair: "#151528",
  eye: "#1b1b1b",
  aura: "#f5a54a",
};

/** Scratch vectors reused every frame — no allocation inside useFrame. */
const camTarget = new THREE.Vector3();

const HAIR_SPIKES: Array<{ p: [number, number, number]; r: [number, number, number] }> = [
  { p: [0, 0.3, 0.02], r: [0.12, 0, 0] },
  { p: [-0.075, 0.27, 0.01], r: [0, 0, 0.4] },
  { p: [0.075, 0.27, 0.01], r: [0, 0, -0.4] },
  { p: [0, 0.27, -0.09], r: [-0.35, 0, 0] },
  { p: [-0.06, 0.25, -0.07], r: [-0.25, 0, 0.28] },
  { p: [0.06, 0.25, -0.07], r: [-0.25, 0, -0.28] },
];

type FighterProps = {
  stateRef: RefObject<CharacterState>;
  keysRef: RefObject<RawKeys>;
  onStats: (s: HudStats) => void;
};

export function Fighter({ stateRef, keysRef, onStats }: FighterProps) {
  const { camera } = useThree();

  const root = useRef<THREE.Group>(null);
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

  // Animation scratch: phase clock + current/target poses (all reused).
  const anim = useRef({ phase: 0, current: createPose(), target: createPose() });
  const frames = useRef({ count: 0, time: 0 });

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
    stateRef.current = next;
    const speed = Math.hypot(next.vx, next.vz);

    // --- pose ------------------------------------------------------------
    const a = anim.current;
    a.phase = advancePhase(a.phase, next.action, speed, delta);
    poseForInto(a.target, next.action, speed, a.phase);
    const blend = 1 - Math.exp(-delta * 16);
    smoothPoseInto(a.current, a.current, a.target, blend);
    const pose: Pose = a.current;

    // --- apply to joints (pure angle → rotation mapping) ------------------
    if (root.current) {
      root.current.position.set(next.x, next.y, next.z);
      root.current.rotation.y = next.facing;
    }
    if (hips.current) hips.current.position.y = HIP_REST_Y + pose.hipsY;
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

    // Ki aura ring: brightens with speed, so movement reads at a distance.
    if (aura.current) {
      const t = Math.min(1, speed / 8);
      const mat = aura.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + 0.34 * t;
      const s = 1 + 0.12 * t;
      aura.current.scale.set(s, 1, s);
      aura.current.rotation.z += delta * (0.6 + 2.4 * t);
    }

    // --- camera ----------------------------------------------------------
    camTarget.set(next.x, CAM_UP + next.y * 0.35, next.z + CAM_BACK);
    camera.position.lerp(camTarget, 1 - Math.exp(-delta * 6));
    camera.lookAt(next.x, next.y + LOOK_AT_Y, next.z);

    // --- 2 Hz stats tick keeps React out of the frame loop ---------------
    const acc = frames.current;
    acc.count += 1;
    acc.time += delta;
    if (acc.time >= 0.5) {
      onStats({
        fps: Math.round(acc.count / acc.time),
        ms: (acc.time / acc.count) * 1000,
        action: next.action,
        speed,
      });
      acc.count = 0;
      acc.time = 0;
    }
  });

  return (
    <group ref={root}>
      {/* Ki aura on the ground plane. */}
      <mesh ref={aura} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.78, 32]} />
        <meshBasicMaterial
          color={BODY.aura}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={hips} position={[0, HIP_REST_Y, 0]}>
        {/* Pelvis + belt */}
        <mesh position={[0, -0.01, 0]} castShadow>
          <boxGeometry args={[0.3, 0.17, 0.22]} />
          <meshStandardMaterial color={BODY.pants} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.09, 0]} castShadow>
          <boxGeometry args={[0.33, 0.08, 0.25]} />
          <meshStandardMaterial color={BODY.belt} roughness={0.7} />
        </mesh>

        <group ref={torso}>
          {/* Gi torso */}
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.44, 0.46, 0.26]} />
            <meshStandardMaterial
              color={BODY.gi}
              roughness={0.6}
              emissive={BODY.gi}
              emissiveIntensity={0.12}
            />
          </mesh>
          {/* Blue undershirt at the collar + waist wrap */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.4, 0.12, 0.27]} />
            <meshStandardMaterial color={BODY.under} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[0.12, 0.08, 0.12]} />
            <meshStandardMaterial color={BODY.skin} roughness={0.9} />
          </mesh>

          {/* Head + spiked hair */}
          <group ref={head} position={[0, 0.74, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.145, 20, 16]} />
              <meshStandardMaterial color={BODY.skin} roughness={0.85} />
            </mesh>
            {/* Eyes: local +Z is forward */}
            <mesh position={[-0.055, 0.02, 0.125]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial color={BODY.eye} roughness={0.4} />
            </mesh>
            <mesh position={[0.055, 0.02, 0.125]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial color={BODY.eye} roughness={0.4} />
            </mesh>
            {HAIR_SPIKES.map((spike, i) => (
              <mesh key={i} position={spike.p} rotation={spike.r} castShadow>
                <coneGeometry args={[0.055, 0.24, 6]} />
                <meshStandardMaterial color={BODY.hair} roughness={0.75} />
              </mesh>
            ))}
          </group>

          {/* Arms: shoulder pivot → upper arm → elbow pivot → forearm → fist */}
          <group ref={shoulderL} position={[-0.26, 0.46, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.18, 4, 10]} />
              <meshStandardMaterial color={BODY.gi} roughness={0.65} />
            </mesh>
            <group ref={elbowL} position={[0, -0.26, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.16, 4, 10]} />
                <meshStandardMaterial color={BODY.skin} roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow>
                <sphereGeometry args={[0.062, 12, 12]} />
                <meshStandardMaterial color={BODY.under} roughness={0.7} />
              </mesh>
            </group>
          </group>
          <group ref={shoulderR} position={[0.26, 0.46, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.18, 4, 10]} />
              <meshStandardMaterial color={BODY.gi} roughness={0.65} />
            </mesh>
            <group ref={elbowR} position={[0, -0.26, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.16, 4, 10]} />
                <meshStandardMaterial color={BODY.skin} roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow>
                <sphereGeometry args={[0.062, 12, 12]} />
                <meshStandardMaterial color={BODY.under} roughness={0.7} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Legs: hip pivot → thigh → knee pivot → shin → boot */}
        <group ref={hipL} position={[-0.11, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.078, 0.24, 4, 10]} />
            <meshStandardMaterial color={BODY.pants} roughness={0.85} />
          </mesh>
          <group ref={kneeL} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.066, 0.2, 4, 10]} />
              <meshStandardMaterial color={BODY.pants} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.37, 0.03]} castShadow>
              <boxGeometry args={[0.14, 0.12, 0.24]} />
              <meshStandardMaterial color={BODY.boot} roughness={0.6} />
            </mesh>
          </group>
        </group>
        <group ref={hipR} position={[0.11, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.078, 0.24, 4, 10]} />
            <meshStandardMaterial color={BODY.pants} roughness={0.85} />
          </mesh>
          <group ref={kneeR} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.066, 0.2, 4, 10]} />
              <meshStandardMaterial color={BODY.pants} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.37, 0.03]} castShadow>
              <boxGeometry args={[0.14, 0.12, 0.24]} />
              <meshStandardMaterial color={BODY.boot} roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
