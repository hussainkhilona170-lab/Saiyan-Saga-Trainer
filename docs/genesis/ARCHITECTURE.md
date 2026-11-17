# Architecture — Genesis

```
src/genesis/
  sim/        Pure TS gameplay (no three/React/DOM) — headless-testable.
    character.ts   movement state machine (idle/walk/run/jump/fall/land/fly/attack)
    animation.ts   procedural pose per action, distance-driven gait clock
    combat.ts      melee/ki hit detection, damage, ki, combatants
    progression.ts XP, levels, resource scaling
    save.ts        versioned save envelope (parse/serialize)
    world.ts       static obstacles (pillars)
  render/     R3F scene + keyboard collection; renders sim state only.
    GenesisScene.tsx   canvas, ground, obstacles, camera, command bus
    FighterRose.tsx     GLTF rig driver (bones, pose, combat, save, enemy/boss AI)
    useKeyboard.ts      raw key state
    cameraRelative.ts  camera-relative move intent + camera collision
    boneNames.ts       sanitised bone-name resolution + aliases
  hud/        HUD reusing Card + design tokens (AGENTS.md UI rules apply).
    GenesisHud.tsx
  genesisBus.ts  cross-tab God Engine ↔ Genesis command channel
  characters.ts   roster (Vanguard, Rosé, Saiyan Prince, …)
  world.ts       obstacles
```

## Data flow
1. `useKeyboard` collects raw keys → `keysRef`.
2. `FighterRose.useFrame` reads keys, calls `moveIntent`, runs `updateCharacter` (pure),
   applies collision, writes `stateRef.current`.
3. Pose is derived from the pure animation layer and applied to bones.
4. HUD stats flow up via `onStats`.

## Rules
- Game rules live in `sim/` as pure functions. The render layer only applies state.
- Animated combat presentation stays in the render/arena modules.
- God Engine reaches the live battle only through `genesisBus`; `GenesisScene` owns
  `BattleState`/player state and applies commands — never edit from the panel.
- `routeTree.gen.ts` is generated — do not hand-edit.
