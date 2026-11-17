import { Canvas } from "@react-three/fiber";
import { useState, useRef, useEffect, type RefObject } from "react";
import { createCharacterState, type CharacterState } from "../sim/character";
import { useKeyboard } from "./useKeyboard";
import { FighterRose } from "./FighterRose";
import { GenesisHud, type HudStats } from "../hud/GenesisHud";
import { CHARACTERS, characterByID, nextCharacterID, type CharacterDef } from "../characters";
import { subscribeGenesisCommands, type GenesisCommand } from "../genesisBus";

const SCENE = {
  background: "#191b2c",
  ground: "#262640",
  grid: "#3d3d68",
  block: "#2f2f52",
  accentBlue: "#4a9eda",
  accentGreen: "#35c98e",
  accentRed: "#e05252",
  ridge: "#1f2038",
};

const CAM_BACK = 3.6;
const CAM_UP = 1.9;

/** Roster entry the scene opens on. Keep in sync with `CHARACTERS`. */
const DEFAULT_CHARACTER_ID = "vanguard";

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
  const teleportRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const commandQueueRef = useRef<GenesisCommand[]>([]);
  const [characterID, setCharacterID] = useState(DEFAULT_CHARACTER_ID);
  const [stats, setStats] = useState<HudStats>({
    fps: 0,
    ms: 0,
    action: "idle",
    speed: 0,
    // Seed from the default roster entry so the HUD never shows a stale name
    // before the first frame reports real stats.
    character: characterByID(DEFAULT_CHARACTER_ID).name,
  });
  const character = characterByID(characterID);

  // God Engine → Genesis command channel (cross-tab).
  useEffect(() => {
    return subscribeGenesisCommands((cmd: GenesisCommand) => {
      commandQueueRef.current.push(cmd);
      switch (cmd.type) {
        case "setCharacter":
          setCharacterID(cmd.id);
          break;
        case "teleport":
          teleportRef.current = { x: cmd.x, y: cmd.y, z: cmd.z };
          break;
        case "reset":
          teleportRef.current = { x: 0, y: 0, z: 0 };
          stateRef.current = createCharacterState();
          break;
      }
    });
  }, []);

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
        <hemisphereLight args={["#ffffff", SCENE.ground, 1.0]} />
        <ambientLight intensity={0.35} />
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
        {/* Physics disabled for diagnosis.
            The slab is 1 m thick and centred on y = 0, so its top face must be
            pushed down to y = 0 — otherwise the fighter stands knee-deep in it. */}
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[200, 1, 200]} />
          <meshStandardMaterial color={SCENE.ground} roughness={1} />
        </mesh>
        <gridHelper args={[160, 80, SCENE.grid, SCENE.grid]} position={[0, 0.02, 0]} />
        <Ridge />
        <Landmarks />
        <FighterRose
          stateRef={stateRef}
          keysRef={keysRef}
          onStats={setStats}
          character={character}
          teleportRef={teleportRef}
          modelUrl={character.model ?? "/assets/characters/rose_saiyan.glb"}
          commandQueueRef={commandQueueRef}
        />
      </Canvas>
      <GenesisHud
        stats={stats}
        onCycleCharacter={() => setCharacterID((id) => nextCharacterID(id))}
      />
    </div>
  );
}
