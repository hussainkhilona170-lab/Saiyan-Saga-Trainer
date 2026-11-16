import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import {
  createCharacterState,
  updateCharacter,
  type CharacterInput,
  type CharacterState,
} from "../sim/character";
import { useKeyboard, type RawKeys } from "./useKeyboard";
import { GenesisHud, type HudStats } from "../hud/GenesisHud";

/**
 * Genesis scene — third-person movement prototype (Phase 1).
 * Colors match the app's oklch tokens from styles.css (hex approximations for
 * scene materials; the HUD itself uses the real Tailwind tokens).
 */
const SCENE = {
  background: "#191b2c", // slightly lifted from --background oklch(0.16 0.04 270) so the horizon reads
  ground: "#262640", // lifted --card tone
  grid: "#3d3d68", // between --muted and --secondary
  block: "#2f2f52", // --secondary family
  character: "#f5a54a", // --primary oklch(0.75 0.18 55)
  face: "#ffe0b0",
  accentBlue: "#4a9eda", // --chart-1 oklch(0.72 0.17 230)
  accentGreen: "#35c98e", // --chart-2 oklch(0.72 0.18 150)
  accentRed: "#e05252", // --destructive family
};

const CHAR_HALF_HEIGHT = 0.95;
const CAM_BACK = 5;
const CAM_UP = 2.2;

/** Scratch vectors reused every frame — never allocate inside useFrame. */
const lookDir = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const camTarget = new THREE.Vector3();

function moveIntent(keys: RawKeys, camera: THREE.Camera): { moveX: number; moveZ: number } {
  const f = (keys.f ? 1 : 0) - (keys.b ? 1 : 0);
  const r = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (f === 0 && r === 0) return { moveX: 0, moveZ: 0 };
  camera.getWorldDirection(lookDir);
  fwd.set(lookDir.x, 0, lookDir.z);
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  right.crossVectors(fwd, up).normalize();
  const mx = fwd.x * f + right.x * r;
  const mz = fwd.z * f + right.z * r;
  const mag = Math.hypot(mx, mz) || 1;
  return { moveX: mx / mag, moveZ: mz / mag };
}

type RigProps = {
  stateRef: RefObject<CharacterState>;
  keysRef: RefObject<RawKeys>;
  onStats: (s: HudStats) => void;
};

/** Drives the sim each frame and applies it to the character group + camera. */
function CharacterRig({ stateRef, keysRef, onStats }: RigProps) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
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

    if (group.current) {
      group.current.position.set(next.x, next.y + CHAR_HALF_HEIGHT, next.z);
      group.current.rotation.y = next.facing;
    }

    // Smooth third-person follow: fixed orientation offset behind the body.
    camTarget.set(next.x, next.y + CAM_UP, next.z + CAM_BACK);
    camera.position.lerp(camTarget, 1 - Math.exp(-delta * 6));
    camera.lookAt(next.x, next.y + 1, next.z);

    // 2 Hz stats tick keeps React out of the frame loop.
    const acc = frames.current;
    acc.count += 1;
    acc.time += delta;
    if (acc.time >= 0.5) {
      onStats({
        fps: Math.round(acc.count / acc.time),
        ms: (acc.time / acc.count) * 1000,
        action: next.action,
      });
      acc.count = 0;
      acc.time = 0;
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 1.1, 6, 16]} />
        <meshStandardMaterial
          color={SCENE.character}
          roughness={0.5}
          emissive={SCENE.character}
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* Face marker so the body's facing reads clearly. */}
      <mesh position={[0, 0.55, -0.28]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={SCENE.face} emissive={SCENE.face} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/** Static reference pillars so motion has strong spatial anchors. */
function Landmarks() {
  const pillars: Array<{ x: number; z: number; h: number; w: number; color: string }> = [
    { x: -8, z: -10, h: 5, w: 1.6, color: SCENE.accentBlue },
    { x: 10, z: -14, h: 7, w: 2, color: SCENE.accentGreen },
    { x: -14, z: 6, h: 3.5, w: 1.4, color: SCENE.accentRed },
    { x: 16, z: 8, h: 9, w: 2.4, color: SCENE.block },
    { x: 0, z: -24, h: 12, w: 3, color: SCENE.block },
    { x: -24, z: -4, h: 4, w: 1.8, color: SCENE.accentBlue },
    { x: 26, z: -8, h: 6, w: 2.2, color: SCENE.accentGreen },
  ];
  return (
    <>
      {pillars.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, p.h, p.w]} />
          <meshStandardMaterial color={p.color} roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}

export default function GenesisScene() {
  const stateRef = useRef<CharacterState>(createCharacterState());
  const keysRef = useKeyboard();
  const [stats, setStats] = useState<HudStats>({ fps: 0, ms: 0, action: "idle" });

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 60, near: 0.1, far: 220, position: [0, CAM_UP, CAM_BACK] }}
        gl={{ antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={[SCENE.background]} />
        <fog attach="fog" args={[SCENE.background, 40, 110]} />
        <hemisphereLight args={[SCENE.face, SCENE.ground, 1.1]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[12, 18, 8]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial color={SCENE.ground} roughness={1} />
        </mesh>
        <gridHelper args={[160, 80, SCENE.grid, SCENE.grid]} position={[0, 0.02, 0]} />
        <Landmarks />
        <CharacterRig stateRef={stateRef} keysRef={keysRef} onStats={setStats} />
      </Canvas>
      <GenesisHud stats={stats} />
    </div>
  );
}
