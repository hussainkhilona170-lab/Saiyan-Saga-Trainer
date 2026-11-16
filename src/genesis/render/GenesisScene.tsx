import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
import { createCharacterState, type CharacterState } from "../sim/character";
import { useKeyboard } from "./useKeyboard";
import { Fighter } from "./Fighter";
import { GenesisHud, type HudStats } from "../hud/GenesisHud";

/**
 * Genesis scene — third-person arena (Phase 2: animated fighter body).
 * Colors match the app's oklch tokens from styles.css (hex approximations for
 * scene materials; the HUD itself uses the real Tailwind tokens).
 */
const SCENE = {
  background: "#191b2c", // slightly lifted from --background oklch(0.16 0.04 270)
  ground: "#262640", // lifted --card tone
  grid: "#3d3d68", // between --muted and --secondary
  block: "#2f2f52", // --secondary family
  accentBlue: "#4a9eda", // --chart-1 oklch(0.72 0.17 230)
  accentGreen: "#35c98e", // --chart-2 oklch(0.72 0.18 150)
  accentRed: "#e05252", // --destructive family
  ridge: "#1f2038",
};

const CAM_BACK = 5;
const CAM_UP = 2.2;

/** Reference pillars give motion strong spatial anchors. */
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

/** Distant ridge line so the horizon reads instead of empty fog. */
function Ridge() {
  const hills = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const radius = 78 + (i % 3) * 6;
    const h = 14 + ((i * 7) % 5) * 3.5;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, h };
  });
  return (
    <>
      {hills.map((hill, i) => (
        <mesh key={i} position={[hill.x, hill.h / 2 - 1, hill.z]}>
          <coneGeometry args={[hill.h * 0.75, hill.h, 5]} />
          <meshStandardMaterial color={SCENE.ridge} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

export default function GenesisScene() {
  const stateRef = useRef<CharacterState>(createCharacterState());
  const keysRef = useKeyboard();
  const [stats, setStats] = useState<HudStats>({ fps: 0, ms: 0, action: "idle", speed: 0 });

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 55, near: 0.1, far: 260, position: [0, CAM_UP, CAM_BACK] }}
        gl={{ antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={[SCENE.background]} />
        <fog attach="fog" args={[SCENE.background, 45, 130]} />
        <hemisphereLight args={["#ffe0b0", SCENE.ground, 1.1]} />
        <ambientLight intensity={0.28} />
        <directionalLight
          position={[12, 18, 8]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={SCENE.ground} roughness={1} />
        </mesh>
        <gridHelper args={[160, 80, SCENE.grid, SCENE.grid]} position={[0, 0.02, 0]} />
        <Ridge />
        <Landmarks />
        <Fighter stateRef={stateRef} keysRef={keysRef} onStats={setStats} />
      </Canvas>
      <GenesisHud stats={stats} />
    </div>
  );
}
